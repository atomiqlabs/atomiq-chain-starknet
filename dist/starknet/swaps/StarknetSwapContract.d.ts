import { ChainSwapType, IntermediaryReputationType, RelaySynchronizer, SignatureData, SwapCommitState, SwapContract, TransactionConfirmationOptions } from "@atomiqlabs/base";
import { Buffer } from "buffer";
import { EscrowManagerAbi, EscrowManagerAbiType } from "./EscrowManagerAbi";
import { StarknetContractBase } from "../contract/StarknetContractBase";
import { StarknetTraceCall, StarknetTx } from "../chain/modules/StarknetTransactions";
import { StarknetSigner } from "../wallet/StarknetSigner";
import { BigNumberish } from "starknet";
import { StarknetChainInterface } from "../chain/StarknetChainInterface";
import { StarknetBtcRelay } from "../btcrelay/StarknetBtcRelay";
import { StarknetSwapData } from "./StarknetSwapData";
import { StarknetLpVault } from "./modules/StarknetLpVault";
import { StarknetPreFetchVerification, StarknetSwapInit } from "./modules/StarknetSwapInit";
import { StarknetSwapRefund } from "./modules/StarknetSwapRefund";
import { IClaimHandler } from "./handlers/claim/ClaimHandlers";
import { StarknetSwapClaim } from "./modules/StarknetSwapClaim";
import { IHandler } from "./handlers/IHandler";
import { StarknetBtcStoredHeader } from "../btcrelay/headers/StarknetBtcStoredHeader";
import { ExtractAbiFunctionNames } from "abi-wan-kanabi/dist/kanabi";
/**
 * Starknet swap contract (escrow manager) contract representation handling PrTLC (on-chain) and HTLC (lightning)
 *  based swaps
 *
 * @category Swaps
 */
export declare class StarknetSwapContract extends StarknetContractBase<typeof EscrowManagerAbi> implements SwapContract<StarknetSwapData, StarknetTx, never, StarknetPreFetchVerification, StarknetSigner, "STARKNET"> {
    /**
     * @inheritDoc
     */
    readonly supportsInitWithoutClaimer = true;
    readonly chainId: "STARKNET";
    /**
     * @inheritDoc
     */
    readonly claimWithSecretTimeout: number;
    /**
     * @inheritDoc
     */
    readonly claimWithTxDataTimeout: number;
    /**
     * @inheritDoc
     */
    readonly refundTimeout: number;
    private readonly claimGracePeriod;
    private readonly refundGracePeriod;
    /**
     * @private
     */
    readonly authGracePeriod: number;
    readonly Init: StarknetSwapInit;
    readonly Refund: StarknetSwapRefund;
    readonly Claim: StarknetSwapClaim;
    readonly LpVault: StarknetLpVault;
    readonly claimHandlersByAddress: {
        [address: string]: IClaimHandler<any, any>;
    };
    readonly claimHandlersBySwapType: {
        [type in ChainSwapType]?: IClaimHandler<any, any>;
    };
    readonly refundHandlersByAddress: {
        [address: string]: IHandler<any, any>;
    };
    readonly timelockRefundHandler: IHandler<any, any>;
    readonly btcRelay: StarknetBtcRelay<any>;
    protected readonly initFunctionName: ExtractAbiFunctionNames<EscrowManagerAbiType>;
    protected readonly initEntryPointSelector: bigint;
    /**
     * Constructs the swap contract (escrow manager)
     *
     * @param chainInterface Underlying chain interface to use
     * @param btcRelay Btc relay light client contract
     * @param contractAddress Optional underlying contract address (default is used otherwise)
     * @param _handlerAddresses Optional handler addresses (defaults are used otherwise)
     */
    constructor(chainInterface: StarknetChainInterface, btcRelay: StarknetBtcRelay<any>, contractAddress?: string, _handlerAddresses?: {
        refund?: {
            timelock?: string;
        };
        claim?: {
            [type in ChainSwapType]?: string;
        };
    });
    /**
     * @inheritDoc
     */
    start(): Promise<void>;
    /**
     * @inheritDoc
     */
    preFetchForInitSignatureVerification(): Promise<StarknetPreFetchVerification>;
    /**
     * @inheritDoc
     */
    getInitSignature(signer: StarknetSigner, swapData: StarknetSwapData, authorizationTimeout: number, preFetchedBlockData?: never, feeRate?: string): Promise<SignatureData>;
    /**
     * @inheritDoc
     */
    isValidInitAuthorization(sender: string, swapData: StarknetSwapData, sig: SignatureData, feeRate?: string, preFetchedData?: StarknetPreFetchVerification): Promise<null>;
    /**
     * @inheritDoc
     */
    getInitAuthorizationExpiry(swapData: StarknetSwapData, sig: SignatureData, preFetchedData?: StarknetPreFetchVerification): Promise<number>;
    /**
     * @inheritDoc
     */
    isInitAuthorizationExpired(swapData: StarknetSwapData, sig: SignatureData): Promise<boolean>;
    /**
     * @inheritDoc
     */
    getRefundSignature(signer: StarknetSigner, swapData: StarknetSwapData, authorizationTimeout: number): Promise<SignatureData>;
    /**
     * @inheritDoc
     */
    isValidRefundAuthorization(swapData: StarknetSwapData, sig: SignatureData): Promise<null>;
    /**
     * @inheritDoc
     */
    getDataSignature(signer: StarknetSigner, data: Buffer): Promise<string>;
    /**
     * @inheritDoc
     */
    isValidDataSignature(data: Buffer, signature: string, publicKey: string): Promise<boolean>;
    /**
     * @inheritDoc
     */
    isClaimable(signer: string, data: StarknetSwapData): Promise<boolean>;
    /**
     * @inheritDoc
     */
    isCommited(swapData: StarknetSwapData): Promise<boolean>;
    /**
     * @inheritDoc
     */
    isExpired(signer: string, data: StarknetSwapData): Promise<boolean>;
    /**
     * @inheritDoc
     */
    isRequestRefundable(signer: string, data: StarknetSwapData): Promise<boolean>;
    /**
     * @inheritDoc
     */
    getHashForTxId(txId: string, confirmations: number): Buffer<ArrayBufferLike>;
    /**
     * @inheritDoc
     */
    getHashForOnchain(outputScript: Buffer, amount: bigint, confirmations: number, nonce?: bigint): Buffer;
    /**
     * @inheritDoc
     */
    getHashForHtlc(paymentHash: Buffer): Buffer;
    /**
     * @inheritDoc
     */
    getExtraData(outputScript: Buffer, amount: bigint, confirmations: number, nonce?: bigint): Buffer;
    /**
     * @inheritDoc
     */
    getCommitStatus(signer: string, data: StarknetSwapData): Promise<SwapCommitState>;
    /**
     * @inheritDoc
     */
    getCommitStatuses(request: {
        signer: string;
        swapData: StarknetSwapData;
    }[]): Promise<{
        [p: string]: SwapCommitState;
    }>;
    /**
     * @inheritDoc
     */
    getHistoricalSwaps(signer: string, startBlockheight?: number): Promise<{
        swaps: {
            [escrowHash: string]: {
                init?: {
                    data: StarknetSwapData;
                    getInitTxId: () => Promise<string>;
                    getTxBlock: () => Promise<{
                        blockTime: number;
                        blockHeight: number;
                    }>;
                };
                state: SwapCommitState;
            };
        };
        latestBlockheight?: number;
    }>;
    /**
     * @inheritDoc
     */
    createSwapData(type: ChainSwapType, offerer: string, claimer: string, token: string, amount: bigint, claimData: string, sequence: bigint, expiry: bigint, payIn: boolean, payOut: boolean, securityDeposit: bigint, claimerBounty: bigint, depositToken?: string): Promise<StarknetSwapData>;
    /**
     *
     * @param call
     * @param escrowHash
     * @param claimHandler
     * @private
     */
    findInitSwapData(call: StarknetTraceCall, escrowHash: BigNumberish, claimHandler: IClaimHandler<any, any>): StarknetSwapData | null;
    /**
     *
     * @param address
     * @param token
     * @private
     */
    private getIntermediaryBalance;
    /**
     * @inheritDoc
     */
    getBalance(signer: string, tokenAddress: string, inContract?: boolean): Promise<bigint>;
    /**
     * @inheritDoc
     */
    getIntermediaryReputation(address: string, token: string): Promise<IntermediaryReputationType>;
    /**
     * @inheritDoc
     */
    txsClaimWithSecret(signer: string | StarknetSigner, swapData: StarknetSwapData, secret: string, checkExpiry?: boolean, initAta?: boolean, feeRate?: string, skipAtaCheck?: boolean): Promise<StarknetTx[]>;
    /**
     * @inheritDoc
     */
    txsClaimWithTxData(signer: string | StarknetSigner, swapData: StarknetSwapData, tx: {
        blockhash: string;
        confirmations: number;
        txid: string;
        hex: string;
        height: number;
    }, requiredConfirmations: number, vout: number, commitedHeader?: StarknetBtcStoredHeader, synchronizer?: RelaySynchronizer<StarknetBtcStoredHeader, StarknetTx, any>, initAta?: boolean, feeRate?: string): Promise<StarknetTx[]>;
    /**
     * @inheritDoc
     */
    txsRefund(signer: string, swapData: StarknetSwapData, check?: boolean, initAta?: boolean, feeRate?: string): Promise<StarknetTx[]>;
    /**
     * @inheritDoc
     */
    txsRefundWithAuthorization(signer: string, swapData: StarknetSwapData, sig: SignatureData, check?: boolean, initAta?: boolean, feeRate?: string): Promise<StarknetTx[]>;
    /**
     * @inheritDoc
     */
    txsInit(sender: string, swapData: StarknetSwapData, sig: SignatureData, skipChecks?: boolean, feeRate?: string): Promise<StarknetTx[]>;
    /**
     * @inheritDoc
     */
    txsWithdraw(signer: string, token: string, amount: bigint, feeRate?: string): Promise<StarknetTx[]>;
    /**
     * @inheritDoc
     */
    txsDeposit(signer: string, token: string, amount: bigint, feeRate?: string): Promise<StarknetTx[]>;
    /**
     * @inheritDoc
     */
    claimWithSecret(signer: StarknetSigner, swapData: StarknetSwapData, secret: string, checkExpiry?: boolean, initAta?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string>;
    /**
     * @inheritDoc
     */
    claimWithTxData(signer: StarknetSigner, swapData: StarknetSwapData, tx: {
        blockhash: string;
        confirmations: number;
        txid: string;
        hex: string;
        height: number;
    }, requiredConfirmations: number, vout: number, commitedHeader?: StarknetBtcStoredHeader, synchronizer?: RelaySynchronizer<StarknetBtcStoredHeader, StarknetTx, any>, initAta?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string>;
    /**
     * @inheritDoc
     */
    refund(signer: StarknetSigner, swapData: StarknetSwapData, check?: boolean, initAta?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string>;
    /**
     * @inheritDoc
     */
    refundWithAuthorization(signer: StarknetSigner, swapData: StarknetSwapData, signature: SignatureData, check?: boolean, initAta?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string>;
    /**
     * @inheritDoc
     */
    init(signer: StarknetSigner, swapData: StarknetSwapData, signature: SignatureData, skipChecks?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string>;
    /**
     * @inheritDoc
     */
    withdraw(signer: StarknetSigner, token: string, amount: bigint, txOptions?: TransactionConfirmationOptions): Promise<string>;
    /**
     * @inheritDoc
     */
    deposit(signer: StarknetSigner, token: string, amount: bigint, txOptions?: TransactionConfirmationOptions): Promise<string>;
    /**
     * @inheritDoc
     */
    getInitPayInFeeRate(offerer?: string, claimer?: string, token?: string, paymentHash?: string): Promise<string>;
    /**
     * @inheritDoc
     */
    getInitFeeRate(offerer?: string, claimer?: string, token?: string, paymentHash?: string): Promise<string>;
    /**
     * @inheritDoc
     */
    getRefundFeeRate(swapData: StarknetSwapData): Promise<string>;
    /**
     * @inheritDoc
     */
    getClaimFeeRate(signer: string, swapData: StarknetSwapData): Promise<string>;
    /**
     * @inheritDoc
     */
    getClaimFee(signer: string, swapData: StarknetSwapData, feeRate?: string): Promise<bigint>;
    /**
     * @inheritDoc
     */
    getCommitFee(signer: string, swapData: StarknetSwapData, feeRate?: string): Promise<bigint>;
    /**
     * @inheritDoc
     */
    getRefundFee(signer: string, swapData: StarknetSwapData, feeRate?: string): Promise<bigint>;
}
