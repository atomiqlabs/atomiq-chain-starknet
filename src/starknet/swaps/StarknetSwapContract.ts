import {
    BigIntBufferUtils,
    ChainSwapType,
    IntermediaryReputationType,
    RelaySynchronizer,
    SignatureData,
    SwapCommitState,
    SwapCommitStateType,
    SwapContract,
    TransactionConfirmationOptions
} from "@atomiqlabs/base";
import {Buffer} from "buffer";
import {EscrowManagerAbi, EscrowManagerAbiType} from "./EscrowManagerAbi";
import {StarknetContractBase} from "../contract/StarknetContractBase";
import {StarknetTraceCall, StarknetTx} from "../chain/modules/StarknetTransactions";
import {StarknetSigner} from "../wallet/StarknetSigner";
import {BigNumberish, constants, hash, logger} from "starknet";
import {StarknetChainInterface} from "../chain/StarknetChainInterface";
import {StarknetBtcRelay} from "../btcrelay/StarknetBtcRelay";
import {StarknetSwapData} from "./StarknetSwapData";
import {bigNumberishToBuffer, bytes31SpanToBuffer, toBigInt, toHex} from "../../utils/Utils";
import {TimelockRefundHandler} from "./handlers/refund/TimelockRefundHandler";
import {StarknetLpVault} from "./modules/StarknetLpVault";
import {StarknetPreFetchVerification, StarknetSwapInit} from "./modules/StarknetSwapInit";
import {StarknetSwapRefund} from "./modules/StarknetSwapRefund";
import {claimHandlersList, IClaimHandler} from "./handlers/claim/ClaimHandlers";
import {StarknetSwapClaim} from "./modules/StarknetSwapClaim";
import {IHandler} from "./handlers/IHandler";
import {StarknetBtcStoredHeader} from "../btcrelay/headers/StarknetBtcStoredHeader";
import {sha256} from "@noble/hashes/sha2";
import {StarknetAbiEvent} from "../contract/modules/StarknetContractEvents";
import {ExtractAbiFunctionNames} from "abi-wan-kanabi/dist/kanabi";

const ESCROW_STATE_COMMITTED = 1;
const ESCROW_STATE_CLAIMED = 2;
const ESCROW_STATE_REFUNDED = 3;

const swapContractAddreses = {
    [constants.StarknetChainId.SN_SEPOLIA]: "0x017bf50dd28b6d823a231355bb25813d4396c8e19d2df03026038714a22f0413",
    [constants.StarknetChainId.SN_MAIN]: "0x04f278e1f19e495c3b1dd35ef307c4f7510768ed95481958fbae588bd173f79a"
};

const swapContractDeploymentHeights = {
    [constants.StarknetChainId.SN_SEPOLIA]: 1118142,
    [constants.StarknetChainId.SN_MAIN]: 1617247
};

const defaultClaimAddresses = {
    [constants.StarknetChainId.SN_SEPOLIA]: {
        [ChainSwapType.HTLC]: "0x04a57ea54d4637c352aad1bbee046868926a11702216a0aaf7eeec1568be2d7b",
        [ChainSwapType.CHAIN_TXID]: "0x04c7cde88359e14b6f6f779f8b9d8310cee37e91a6f143f855ae29fab33c396e",
        [ChainSwapType.CHAIN]: "0x051bef6f5fd12e2832a7d38653bdfc8eb84ba7eb7a4aada5b87ef38a9999cf17",
        [ChainSwapType.CHAIN_NONCED]: "0x050e50eacd16da414f2c3a7c3570fd5e248974c6fe757d41acbf72d2836fa0a1"
    },
    [constants.StarknetChainId.SN_MAIN]: {
        [ChainSwapType.HTLC]: "0x07b74b50a883ebee262b6db0e3c0c697670c6f30e3d610e75faf33a89c46aa2a",
        [ChainSwapType.CHAIN_TXID]: "0x016c2db2b03f39cf4fd7f871035000f66b62307d9983056e33a38315da8a44dc",
        [ChainSwapType.CHAIN]: "0x02c45a81c4a48d0645a0a199e620061e8a55dcc9c2b5946d050eaeeddba64e9a",
        [ChainSwapType.CHAIN_NONCED]: "0x0019b5480dd7ed8ded10a09437b0a7a30b8997b4ef139deb24ff8c86f995d84f"
    }
}

const defaultRefundAddresses = {
    [constants.StarknetChainId.SN_SEPOLIA]: {
        timelock: "0x034b8f28b3ca979036cb2849cfa3af7f67207459224b6ca5ce2474aa398ec3e7"
    },
    [constants.StarknetChainId.SN_MAIN]: {
        timelock: "0x06a59659990c2aefbf7239f6d911617b3ae60b79cb3364f3bd242a6ca8f4f4f7"
    }
}

/**
 * Starknet swap contract (escrow manager) contract representation handling PrTLC (on-chain) and HTLC (lightning)
 *  based swaps
 *
 * @category Swaps
 */
export class StarknetSwapContract
    extends StarknetContractBase<typeof EscrowManagerAbi>
    implements SwapContract<
        StarknetSwapData,
        StarknetTx,
        never,
        StarknetPreFetchVerification,
        StarknetSigner,
        "STARKNET"
    > {

    /**
     * @inheritDoc
     */
    readonly supportsInitWithoutClaimer = true;

    ////////////////////////
    //// Constants
    readonly chainId: "STARKNET" = "STARKNET";

    ////////////////////////
    //// Timeouts
    /**
     * @inheritDoc
     */
    readonly claimWithSecretTimeout: number = 180;
    /**
     * @inheritDoc
     */
    readonly claimWithTxDataTimeout: number = 180;
    /**
     * @inheritDoc
     */
    readonly refundTimeout: number = 180;

    private readonly claimGracePeriod: number = 10*60;
    private readonly refundGracePeriod: number = 10*60;
    /**
     * @private
     */
    readonly authGracePeriod: number = 30;

    ////////////////////////
    //// Services
    readonly Init: StarknetSwapInit;
    readonly Refund: StarknetSwapRefund;
    readonly Claim: StarknetSwapClaim;
    readonly LpVault: StarknetLpVault;

    ////////////////////////
    //// Handlers
    readonly claimHandlersByAddress: {[address: string]: IClaimHandler<any, any>} = {};
    readonly claimHandlersBySwapType: {[type in ChainSwapType]?: IClaimHandler<any, any>} = {};

    readonly refundHandlersByAddress: {[address: string]: IHandler<any, any>} = {};
    readonly timelockRefundHandler: IHandler<any, any>;

    readonly btcRelay: StarknetBtcRelay<any>;

    protected readonly initFunctionName: ExtractAbiFunctionNames<EscrowManagerAbiType> = "initialize";
    protected readonly initEntryPointSelector = BigInt(hash.starknetKeccak(this.initFunctionName));

    /**
     * Constructs the swap contract (escrow manager)
     *
     * @param chainInterface Underlying chain interface to use
     * @param btcRelay Btc relay light client contract
     * @param contractAddress Optional underlying contract address (default is used otherwise)
     * @param _handlerAddresses Optional handler addresses (defaults are used otherwise)
     * @param contractDeploymentHeight The height at which this contract was deployed (default is used otherwise)
     */
    constructor(
        chainInterface: StarknetChainInterface,
        btcRelay: StarknetBtcRelay<any>,
        contractAddress: string = swapContractAddreses[chainInterface.starknetChainId],
        _handlerAddresses?: {
            refund?: {
                timelock?: string
            },
            claim?: {
                [type in ChainSwapType]?: string
            }
        },
        contractDeploymentHeight?: number
    ) {
        super(
            chainInterface, contractAddress, EscrowManagerAbi,
            contractDeploymentHeight ??
            (swapContractAddreses[chainInterface.starknetChainId]===contractAddress
                ? swapContractDeploymentHeights[chainInterface.starknetChainId]
                : undefined)
        );
        this.Init = new StarknetSwapInit(chainInterface, this);
        this.Refund = new StarknetSwapRefund(chainInterface, this);
        this.Claim = new StarknetSwapClaim(chainInterface, this);
        this.LpVault = new StarknetLpVault(chainInterface, this);

        this.btcRelay = btcRelay;

        const handlerAddresses = {
            refund: {...defaultRefundAddresses[chainInterface.starknetChainId], ..._handlerAddresses?.refund},
            claim: {...defaultClaimAddresses[chainInterface.starknetChainId], ..._handlerAddresses?.claim}
        };

        claimHandlersList.forEach(handlerCtor => {
            const handler = new handlerCtor(handlerAddresses.claim[handlerCtor.type]);
            this.claimHandlersByAddress[toHex(handler.address)] = handler;
            this.claimHandlersBySwapType[handlerCtor.type] = handler;
        });

        this.timelockRefundHandler = new TimelockRefundHandler(handlerAddresses.refund.timelock);
        this.refundHandlersByAddress[this.timelockRefundHandler.address] = this.timelockRefundHandler;
    }

    /**
     * @inheritDoc
     */
    async start(): Promise<void> {
    }

    ////////////////////////////////////////////
    //// Signatures
    /**
     * @inheritDoc
     */
    preFetchForInitSignatureVerification(): Promise<StarknetPreFetchVerification> {
        return this.Init.preFetchForInitSignatureVerification();
    }

    /**
     * @inheritDoc
     */
    getInitSignature(signer: StarknetSigner, swapData: StarknetSwapData, authorizationTimeout: number, preFetchedBlockData?: never, feeRate?: string): Promise<SignatureData> {
        return this.Init.signSwapInitialization(signer, swapData, authorizationTimeout);
    }

    /**
     * @inheritDoc
     */
    isValidInitAuthorization(sender: string, swapData: StarknetSwapData, sig: SignatureData, feeRate?: string, preFetchedData?: StarknetPreFetchVerification): Promise<null> {
        return this.Init.isSignatureValid(sender, swapData, sig.timeout, sig.prefix, sig.signature, preFetchedData);
    }

    /**
     * @inheritDoc
     */
    getInitAuthorizationExpiry(swapData: StarknetSwapData, sig: SignatureData, preFetchedData?: StarknetPreFetchVerification): Promise<number> {
        return this.Init.getSignatureExpiry(sig.timeout);
    }

    /**
     * @inheritDoc
     */
    isInitAuthorizationExpired(swapData: StarknetSwapData, sig: SignatureData): Promise<boolean> {
        return this.Init.isSignatureExpired(sig.timeout);
    }

    /**
     * @inheritDoc
     */
    getRefundSignature(signer: StarknetSigner, swapData: StarknetSwapData, authorizationTimeout: number): Promise<SignatureData> {
        return this.Refund.signSwapRefund(signer, swapData, authorizationTimeout);
    }

    /**
     * @inheritDoc
     */
    isValidRefundAuthorization(swapData: StarknetSwapData, sig: SignatureData): Promise<null> {
        return this.Refund.isSignatureValid(swapData, sig.timeout, sig.prefix, sig.signature);
    }

    /**
     * @inheritDoc
     */
    getDataSignature(signer: StarknetSigner, data: Buffer): Promise<string> {
        return this.Chain.Signatures.getDataSignature(signer, data);
    }

    /**
     * @inheritDoc
     */
    isValidDataSignature(data: Buffer, signature: string, publicKey: string): Promise<boolean> {
        return this.Chain.Signatures.isValidDataSignature(data, signature, publicKey);
    }

    ////////////////////////////////////////////
    //// Swap data utils
    /**
     * @inheritDoc
     */
    async isClaimable(signer: string, data: StarknetSwapData): Promise<boolean> {
        if(!data.isClaimer(signer)) return false;
        if(await this.isExpired(signer, data)) return false;
        return await this.isCommited(data);
    }

    /**
     * @inheritDoc
     */
    async isCommited(swapData: StarknetSwapData): Promise<boolean> {
        const data = await this.contract.get_hash_state("0x"+swapData.getEscrowHash());
        return Number(data.state)===ESCROW_STATE_COMMITTED;
    }

    /**
     * @inheritDoc
     */
    isExpired(signer: string, data: StarknetSwapData): Promise<boolean> {
        let currentTimestamp: bigint = BigInt(Math.floor(Date.now()/1000));
        if(data.isClaimer(signer)) currentTimestamp = currentTimestamp + BigInt(this.claimGracePeriod);
        if(data.isOfferer(signer)) currentTimestamp = currentTimestamp - BigInt(this.refundGracePeriod);
        return Promise.resolve(data.getExpiry() < currentTimestamp);
    }

    /**
     * @inheritDoc
     */
    async isRequestRefundable(signer: string, data: StarknetSwapData): Promise<boolean> {
        //Swap can only be refunded by the offerer
        if(!data.isOfferer(signer)) return false;
        if(!(await this.isExpired(signer, data))) return false;
        return await this.isCommited(data);
    }

    /**
     * @inheritDoc
     */
    getHashForTxId(txId: string, confirmations: number) {
        const chainTxIdHandler = this.claimHandlersBySwapType[ChainSwapType.CHAIN_TXID];
        if(chainTxIdHandler==null) throw new Error("Claim handler for CHAIN_TXID not found!");
        return bigNumberishToBuffer(chainTxIdHandler.getCommitment({
            txId,
            confirmations,
            btcRelay: this.btcRelay
        }), 32);
    }

    /**
     * @inheritDoc
     */
    getHashForOnchain(outputScript: Buffer, amount: bigint, confirmations: number, nonce?: bigint): Buffer {
        let result: BigNumberish;
        if(nonce==null || nonce === 0n) {
            const chainHandler = this.claimHandlersBySwapType[ChainSwapType.CHAIN];
            if(chainHandler==null) throw new Error("Claim handler for CHAIN not found!");
            result = chainHandler.getCommitment({
                output: outputScript,
                amount,
                confirmations,
                btcRelay: this.btcRelay
            });
        } else {
            const chainNoncedHandler = this.claimHandlersBySwapType[ChainSwapType.CHAIN_NONCED];
            if(chainNoncedHandler==null) throw new Error("Claim handler for CHAIN_NONCED not found!");
            result = chainNoncedHandler.getCommitment({
                output: outputScript,
                amount,
                nonce,
                confirmations,
                btcRelay: this.btcRelay
            });
        }
        return bigNumberishToBuffer(result, 32);
    }

    /**
     * @inheritDoc
     */
    getHashForHtlc(paymentHash: Buffer): Buffer {
        const htlcHandler = this.claimHandlersBySwapType[ChainSwapType.HTLC];
        if(htlcHandler==null) throw new Error("Claim handler for HTLC not found!");
        return bigNumberishToBuffer(htlcHandler.getCommitment(paymentHash), 32);
    }

    /**
     * @inheritDoc
     */
    getExtraData(outputScript: Buffer, amount: bigint, confirmations: number, nonce?: bigint): Buffer {
        if(nonce==null) nonce = 0n;
        const txoHash = Buffer.from(sha256(Buffer.concat([
            BigIntBufferUtils.toBuffer(amount, "le", 8),
            outputScript
        ])));
        return Buffer.concat([
            txoHash,
            BigIntBufferUtils.toBuffer(nonce, "be", 8),
            BigIntBufferUtils.toBuffer(BigInt(confirmations), "be", 2)
        ]);
    }


    ////////////////////////////////////////////
    //// Swap data getters
    /**
     * @inheritDoc
     */
    async getCommitStatus(signer: string, data: StarknetSwapData): Promise<SwapCommitState> {
        const escrowHash = data.getEscrowHash();
        const stateData = await this.contract.get_hash_state("0x"+escrowHash);
        const state = Number(stateData.state);
        const blockHeight = Number(stateData.finish_blockheight);
        switch(state) {
            case ESCROW_STATE_COMMITTED:
                if(data.isOfferer(signer) && await this.isExpired(signer,data)) return {type: SwapCommitStateType.REFUNDABLE};
                return {type: SwapCommitStateType.COMMITED};
            case ESCROW_STATE_CLAIMED:
                return {
                    type: SwapCommitStateType.PAID,
                    getTxBlock: async () => {
                        return {
                            blockTime: await this.Chain.Blocks.getBlockTime(blockHeight),
                            blockHeight: blockHeight
                        };
                    },
                    getClaimTxId: async () => {
                        const events = await this.Events.getContractBlockEvents(
                            ["escrow_manager::events::Claim"],
                            [null, null, null, "0x"+escrowHash],
                            blockHeight, blockHeight
                        );
                        if(events.length===0) throw new Error("Claim event not found!");
                        return events[0].txHash;
                    },
                    getClaimResult: async () => {
                        const events = await this.Events.getContractBlockEvents(
                            ["escrow_manager::events::Claim"],
                            [null, null, null, "0x"+escrowHash],
                            blockHeight, blockHeight
                        );
                        if(events.length===0) throw new Error("Claim event not found!");
                        const event = events[0];
                        const claimHandlerHex = toHex(event.params.claim_handler);
                        const claimHandler = this.claimHandlersByAddress[claimHandlerHex];
                        if(claimHandler==null) {
                            throw new Error("getClaimResult("+escrowHash+"): Unknown claim handler with claim: "+claimHandlerHex);
                        }
                        return claimHandler.parseWitnessResult(event.params.witness_result);
                    }
                };
            case ESCROW_STATE_REFUNDED:
                return {
                    type: await this.isExpired(signer, data) ? SwapCommitStateType.EXPIRED : SwapCommitStateType.NOT_COMMITED,
                    getTxBlock: async () => {
                        return {
                            blockTime: await this.Chain.Blocks.getBlockTime(blockHeight),
                            blockHeight: blockHeight
                        };
                    },
                    getRefundTxId: async () => {
                        const events = await this.Events.getContractBlockEvents(
                          ["escrow_manager::events::Refund"],
                          [null, null, null, "0x"+escrowHash],
                          blockHeight, blockHeight
                        );
                        if(events.length===0) throw new Error("Refund event not found!");
                        return events[0].txHash;
                    }
                };
            default:
                return {
                    type: await this.isExpired(signer, data) ? SwapCommitStateType.EXPIRED : SwapCommitStateType.NOT_COMMITED
                };
        }
    }

    /**
     * @inheritDoc
     */
    async getCommitStatuses(request: { signer: string; swapData: StarknetSwapData }[]): Promise<{
        [p: string]: SwapCommitState
    }> {
        const result: {
            [p: string]: SwapCommitState
        } = {};
        let promises: Promise<void>[] = [];
        //TODO: We can upgrade this to use multicall
        for(let {signer, swapData} of request) {
            promises.push(this.getCommitStatus(signer, swapData).then(val => {
                result[swapData.getEscrowHash()] = val;
            }));
            if(promises.length>=this.Chain.config.maxParallelCalls!) {
                await Promise.all(promises);
                promises = [];
            }
        }
        await Promise.all(promises);
        return result;
    }

    /**
     * @inheritDoc
     */
    async getHistoricalSwaps(signer: string, startBlockheight?: number): Promise<{
        swaps: {
            [escrowHash: string]: {
                init?: {
                    data: StarknetSwapData;
                    getInitTxId: () => Promise<string>;
                    getTxBlock: () => Promise<{ blockTime: number; blockHeight: number }>
                };
                state: SwapCommitState
            }
        };
        latestBlockheight?: number
    }> {
        const {height: latestBlockheight} = await this.Chain.getFinalizedBlock();

        const swapsOpened: {
            [escrowHash: string]: {
                data: Promise<StarknetSwapData | null>,
                getInitTxId: () => Promise<string>,
                getTxBlock: () => Promise<{
                    blockTime: number,
                    blockHeight: number
                }>
            }
        } = {};
        const resultingSwaps: {
            [escrowHash: string]: {
                init?: {
                    data: StarknetSwapData;
                    getInitTxId: () => Promise<string>;
                    getTxBlock: () => Promise<{ blockTime: number; blockHeight: number }>
                };
                state: SwapCommitState
            }
        } = {};

        const promises: Promise<void>[] = [];

        const processor = async (_event: StarknetAbiEvent<
            EscrowManagerAbiType,
            "escrow_manager::events::Initialize" | "escrow_manager::events::Claim" | "escrow_manager::events::Refund"
        >) => {
            const escrowHash = toHex(_event.params.escrow_hash).substring(2);
            if(_event.name==="escrow_manager::events::Initialize") {
                const event = _event as StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Initialize">;
                const claimHandlerHex = toHex(event.params.claim_handler);
                const claimHandler = this.claimHandlersByAddress[claimHandlerHex];
                if(claimHandler==null) {
                    logger.warn(`getHistoricalSwaps(Initialize): Unknown claim handler in tx ${event.txHash} with claim handler: `+claimHandlerHex);
                    return null;
                }

                swapsOpened[escrowHash] = {
                    data: (async () => {
                        const txTrace = await this.Chain.Transactions.traceTransaction(event.txHash, event.blockHash);
                        if(txTrace==null) {
                            logger.warn(`getHistoricalSwaps(Initialize): Cannot get transaction trace for tx ${event.txHash}`);
                            return null;
                        }
                        const data = this.findInitSwapData(txTrace, event.params.escrow_hash, claimHandler);
                        if(data==null) {
                            logger.warn(`getHistoricalSwaps(Initialize): Cannot parse swap data from tx ${event.txHash} with escrow hash: `+escrowHash);
                            return null;
                        }
                        return data;
                    })(),
                    getInitTxId: () => Promise.resolve(event.txHash),
                    getTxBlock: async () => {
                        return {
                            blockHeight: event.blockNumber!,
                            blockTime: await this.Chain.Blocks.getBlockTime(event.blockNumber!)
                        }
                    }
                }
            }
            if(_event.name==="escrow_manager::events::Claim") {
                const event = _event as StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Claim">;
                const claimHandlerHex = toHex(event.params.claim_handler);
                const claimHandler = this.claimHandlersByAddress[claimHandlerHex];
                if(claimHandler==null) {
                    logger.warn(`getHistoricalSwaps(Claim): Unknown claim handler in tx ${event.txHash} with claim handler: `+claimHandlerHex);
                    return null;
                }

                const foundSwapData = swapsOpened[escrowHash];
                delete swapsOpened[escrowHash];
                promises.push((async() => {
                    const data = await foundSwapData?.data;
                    resultingSwaps[escrowHash] = {
                        init: data==null ? undefined : {
                            data,
                            getInitTxId: foundSwapData.getInitTxId,
                            getTxBlock: foundSwapData.getTxBlock
                        },
                        state: {
                            type: SwapCommitStateType.PAID,
                            getClaimTxId: () => Promise.resolve(event.txHash),
                            getClaimResult: () => Promise.resolve(claimHandler.parseWitnessResult(event.params.witness_result)),
                            getTxBlock: async () => {
                                return {
                                    blockHeight: event.blockNumber!,
                                    blockTime: await this.Chain.Blocks.getBlockTime(event.blockNumber!)
                                }
                            }
                        }
                    }
                })());
            }
            if(_event.name==="escrow_manager::events::Refund") {
                const event = _event as StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Refund">;
                const foundSwapData = swapsOpened[escrowHash];
                delete swapsOpened[escrowHash];
                promises.push((async() => {
                    const data = await foundSwapData?.data;
                    const isExpired = data!=null && await this.isExpired(signer, data);
                    resultingSwaps[escrowHash] = {
                        init: data==null ? undefined : {
                            data,
                            getInitTxId: foundSwapData.getInitTxId,
                            getTxBlock: foundSwapData.getTxBlock
                        },
                        state: {
                            type: isExpired ? SwapCommitStateType.EXPIRED : SwapCommitStateType.NOT_COMMITED,
                            getRefundTxId: () => Promise.resolve(event.txHash),
                            getTxBlock: async () => {
                                return {
                                    blockHeight: event.blockNumber!,
                                    blockTime: await this.Chain.Blocks.getBlockTime(event.blockNumber!)
                                }
                            }
                        }
                    }
                })());
            }
        };

        //We have to fetch separately the different directions
        await this.Events.findInContractEventsForward(
            ["escrow_manager::events::Initialize", "escrow_manager::events::Claim", "escrow_manager::events::Refund"],
            [signer, null],
            processor,
            startBlockheight
        );
        await this.Events.findInContractEventsForward(
            ["escrow_manager::events::Initialize", "escrow_manager::events::Claim", "escrow_manager::events::Refund"],
            [null, signer],
            processor,
            startBlockheight
        )

        for(let escrowHash in swapsOpened) {
            const foundSwapData = swapsOpened[escrowHash];
            const data = await foundSwapData.data;
            if(data==null) continue;
            resultingSwaps[escrowHash] = {
                init: {
                    data,
                    getInitTxId: foundSwapData.getInitTxId,
                    getTxBlock: foundSwapData.getTxBlock
                },
                state: data.isOfferer(signer) && await this.isExpired(signer, data)
                    ? {type: SwapCommitStateType.REFUNDABLE}
                    : {type: SwapCommitStateType.COMMITED}
            }
        }

        await Promise.all(promises);

        logger.debug(`getHistoricalSwaps(): Found ${Object.keys(resultingSwaps).length} settled swaps!`);
        logger.debug(`getHistoricalSwaps(): Found ${Object.keys(swapsOpened).length} unsettled swaps!`);

        return {
            swaps: resultingSwaps,
            latestBlockheight: latestBlockheight ?? startBlockheight
        };
    }

    ////////////////////////////////////////////
    //// Swap data initializer
    /**
     * @inheritDoc
     */
    createSwapData(
        type: ChainSwapType,
        offerer: string,
        claimer: string,
        token: string,
        amount: bigint,
        claimData: string,
        sequence: bigint,
        expiry: bigint,
        payIn: boolean,
        payOut: boolean,
        securityDeposit: bigint,
        claimerBounty: bigint,
        depositToken: string = this.Chain.Tokens.getNativeCurrencyAddress()
    ): Promise<StarknetSwapData> {
        const claimHandler = this.claimHandlersBySwapType[type];
        if(claimHandler==null) throw new Error("Invalid claim handler for type: "+ChainSwapType[type]);

        return Promise.resolve(new StarknetSwapData({
            offerer,
            claimer,
            token,
            refundHandler: this.timelockRefundHandler.address,
            claimHandler: claimHandler.address,
            payOut,
            payIn,
            reputation: payIn, //For now track reputation for all payIn swaps
            sequence,
            claimData: "0x"+claimData,
            refundData: toHex(expiry),
            amount,
            feeToken: depositToken,
            securityDeposit,
            claimerBounty,
            kind: type
        }));
    }

    /**
     *
     * @param call
     * @param escrowHash
     * @param claimHandler
     * @private
     */
    findInitSwapData(call: StarknetTraceCall, escrowHash: BigNumberish, claimHandler: IClaimHandler<any, any>): StarknetSwapData | null {
        if(
            BigInt(call.contract_address)===BigInt(this.contract.address) &&
            BigInt(call.entry_point_selector)===this.initEntryPointSelector
        ) {
            //Found, check correct escrow hash
            const escrow = StarknetSwapData.fromSerializedFeltArray(call.calldata, claimHandler);
            if(call.calldata.length < 1) throw new Error("Calldata invalid length");
            const signatureLen = Number(toBigInt(call.calldata.shift()!));
            if(call.calldata.length < signatureLen + 2) throw new Error("Calldata invalid length");
            const _signature = call.calldata.splice(0, signatureLen);
            const _timeout = toBigInt(call.calldata.shift()!);
            const extraDataLen = Number(toBigInt(call.calldata.shift()!));
            if(call.calldata.length < extraDataLen) throw new Error("Calldata invalid length");
            const extraData = call.calldata.splice(0, extraDataLen);
            if(call.calldata.length!==0) throw new Error("Calldata not read fully!");

            if("0x"+escrow.getEscrowHash()===toHex(escrowHash)) {
                if(extraData.length!==0) {
                    escrow.setExtraData(bytes31SpanToBuffer(extraData, 42).toString("hex"));
                }
                return escrow;
            }
        }
        for(let _call of call.calls) {
            const found = this.findInitSwapData(_call, escrowHash, claimHandler);
            if(found!=null) return found;
        }
        return null;
    }

    ////////////////////////////////////////////
    //// Utils
    /**
     *
     * @param address
     * @param token
     * @private
     */
    private getIntermediaryBalance(address: string, token: string): Promise<bigint> {
        return this.LpVault.getIntermediaryBalance(address, token);
    }

    /**
     * @inheritDoc
     */
    async getBalance(signer: string, tokenAddress: string, inContract?: boolean): Promise<bigint> {
        if(inContract) return await this.getIntermediaryBalance(signer, tokenAddress);

        //TODO: For native token we should discount the cost of deploying an account if it is not deployed yet
        return await this.Chain.getBalance(signer, tokenAddress);
    }

    /**
     * @inheritDoc
     */
    getIntermediaryReputation(address: string, token: string): Promise<IntermediaryReputationType> {
        return this.LpVault.getIntermediaryReputation(address, token);
    }

    ////////////////////////////////////////////
    //// Transaction initializers
    /**
     * @inheritDoc
     */
    async txsClaimWithSecret(
        signer: string | StarknetSigner,
        swapData: StarknetSwapData,
        secret: string,
        checkExpiry?: boolean,
        initAta?: boolean,
        feeRate?: string,
        skipAtaCheck?: boolean
    ): Promise<StarknetTx[]> {
        return this.Claim.txsClaimWithSecret(typeof(signer)==="string" ? signer : signer.getAddress(), swapData, secret, checkExpiry, feeRate)
    }

    /**
     * @inheritDoc
     */
    async txsClaimWithTxData(
        signer: string | StarknetSigner,
        swapData: StarknetSwapData,
        tx: { blockhash: string, confirmations: number, txid: string, hex: string, height: number },
        requiredConfirmations: number,
        vout: number,
        commitedHeader?: StarknetBtcStoredHeader,
        synchronizer?: RelaySynchronizer<StarknetBtcStoredHeader, StarknetTx, any>,
        initAta?: boolean,
        feeRate?: string
    ): Promise<StarknetTx[]> {
        return this.Claim.txsClaimWithTxData(
            typeof(signer)==="string" ? signer : signer.getAddress(),
            swapData,
            tx,
            requiredConfirmations,
            vout,
            commitedHeader,
            synchronizer,
            feeRate
        );
    }

    /**
     * @inheritDoc
     */
    txsRefund(signer: string, swapData: StarknetSwapData, check?: boolean, initAta?: boolean, feeRate?: string): Promise<StarknetTx[]> {
        return this.Refund.txsRefund(signer, swapData, check, feeRate);
    }

    /**
     * @inheritDoc
     */
    txsRefundWithAuthorization(signer: string, swapData: StarknetSwapData, sig: SignatureData, check?: boolean, initAta?: boolean, feeRate?: string): Promise<StarknetTx[]> {
        return this.Refund.txsRefundWithAuthorization(signer, swapData, sig.timeout, sig.prefix, sig.signature, check, feeRate);
    }

    /**
     * @inheritDoc
     */
    txsInit(sender: string, swapData: StarknetSwapData, sig: SignatureData, skipChecks?: boolean, feeRate?: string): Promise<StarknetTx[]> {
        return this.Init.txsInit(sender, swapData, sig.timeout, sig.prefix, sig.signature, skipChecks, feeRate);
    }

    /**
     * @inheritDoc
     */
    txsWithdraw(signer: string, token: string, amount: bigint, feeRate?: string): Promise<StarknetTx[]> {
        return this.LpVault.txsWithdraw(signer, token, amount, feeRate);
    }

    /**
     * @inheritDoc
     */
    txsDeposit(signer: string, token: string, amount: bigint, feeRate?: string): Promise<StarknetTx[]> {
        return this.LpVault.txsDeposit(signer, token, amount, feeRate);
    }

    ////////////////////////////////////////////
    //// Executors
    /**
     * @inheritDoc
     */
    async claimWithSecret(
        signer: StarknetSigner,
        swapData: StarknetSwapData,
        secret: string,
        checkExpiry?: boolean,
        initAta?: boolean,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        const result = await this.Claim.txsClaimWithSecret(signer.getAddress(), swapData, secret, checkExpiry, txOptions?.feeRate);
        const [signature] = await this.Chain.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return signature;
    }

    /**
     * @inheritDoc
     */
    async claimWithTxData(
        signer: StarknetSigner,
        swapData: StarknetSwapData,
        tx: { blockhash: string, confirmations: number, txid: string, hex: string, height: number },
        requiredConfirmations: number,
        vout: number,
        commitedHeader?: StarknetBtcStoredHeader,
        synchronizer?: RelaySynchronizer<StarknetBtcStoredHeader, StarknetTx, any>,
        initAta?: boolean,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        const txs = await this.Claim.txsClaimWithTxData(
            signer.getAddress(), swapData, tx, requiredConfirmations, vout,
            commitedHeader, synchronizer, txOptions?.feeRate
        );
        if(txs===null) throw new Error("Btc relay not synchronized to required blockheight!");

        //TODO: This doesn't return proper tx signature
        const [signature] = await this.Chain.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal);

        return signature;
    }

    /**
     * @inheritDoc
     */
    async refund(
        signer: StarknetSigner,
        swapData: StarknetSwapData,
        check?: boolean,
        initAta?: boolean,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        let result = await this.txsRefund(signer.getAddress(), swapData, check, initAta, txOptions?.feeRate);

        const [signature] = await this.Chain.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);

        return signature;
    }

    /**
     * @inheritDoc
     */
    async refundWithAuthorization(
        signer: StarknetSigner,
        swapData: StarknetSwapData,
        signature: SignatureData,
        check?: boolean,
        initAta?: boolean,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        let result = await this.txsRefundWithAuthorization(signer.getAddress(), swapData, signature, check, initAta, txOptions?.feeRate);

        const [txSignature] = await this.Chain.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);

        return txSignature;
    }

    /**
     * @inheritDoc
     */
    async init(
        signer: StarknetSigner,
        swapData: StarknetSwapData,
        signature: SignatureData,
        skipChecks?: boolean,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        if(swapData.isPayIn()) {
            if(!swapData.isOfferer(signer.getAddress())) throw new Error("Invalid signer provided!");
        } else {
            if(!swapData.isClaimer(signer.getAddress())) throw new Error("Invalid signer provided!");
        }

        let result = await this.txsInit(signer.getAddress(), swapData, signature, skipChecks, txOptions?.feeRate);

        const [txSignature] = await this.Chain.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);

        return txSignature;
    }

    /**
     * @inheritDoc
     */
    async withdraw(
        signer: StarknetSigner,
        token: string,
        amount: bigint,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        const txs = await this.LpVault.txsWithdraw(signer.getAddress(), token, amount, txOptions?.feeRate);
        const [txId] = await this.Chain.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal, false);
        return txId;
    }

    /**
     * @inheritDoc
     */
    async deposit(
        signer: StarknetSigner,
        token: string,
        amount: bigint,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        const txs = await this.LpVault.txsDeposit(signer.getAddress(), token, amount, txOptions?.feeRate);
        const [txId] = await this.Chain.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal, false);
        return txId;
    }

    ////////////////////////////////////////////
    //// Fees
    /**
     * @inheritDoc
     */
    getInitPayInFeeRate(offerer?: string, claimer?: string, token?: string, paymentHash?: string): Promise<string> {
        return this.Chain.Fees.getFeeRate();
    }

    /**
     * @inheritDoc
     */
    getInitFeeRate(offerer?: string, claimer?: string, token?: string, paymentHash?: string): Promise<string> {
        return this.Chain.Fees.getFeeRate();
    }

    /**
     * @inheritDoc
     */
    getRefundFeeRate(swapData: StarknetSwapData): Promise<string> {
        return this.Chain.Fees.getFeeRate();
    }

    /**
     * @inheritDoc
     */
    getClaimFeeRate(signer: string, swapData: StarknetSwapData): Promise<string> {
        return this.Chain.Fees.getFeeRate();
    }

    /**
     * @inheritDoc
     */
    getClaimFee(signer: string, swapData: StarknetSwapData, feeRate?: string): Promise<bigint> {
        return this.Claim.getClaimFee(swapData, feeRate);
    }

    /**
     * @inheritDoc
     */
    getCommitFee(signer: string, swapData: StarknetSwapData, feeRate?: string): Promise<bigint> {
        return this.Init.getInitFee(swapData, feeRate);
    }

    /**
     * @inheritDoc
     */
    getRefundFee(signer: string, swapData: StarknetSwapData, feeRate?: string): Promise<bigint> {
        return this.Refund.getRefundFee(swapData, feeRate);
    }

}
