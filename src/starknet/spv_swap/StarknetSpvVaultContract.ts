import {
    BitcoinRpc,
    BtcTx,
    RelaySynchronizer,
    SpvVaultContract,
    SpvVaultTokenData,
    SpvWithdrawalState,
    SpvWithdrawalStateType,
    SpvWithdrawalTransactionData,
    TransactionConfirmationOptions
} from "@atomiqlabs/base";
import {Buffer} from "buffer";
import {StarknetTx} from "../chain/modules/StarknetTransactions";
import {StarknetContractBase} from "../contract/StarknetContractBase";
import {StarknetChainInterface} from "../chain/StarknetChainInterface";
import {StarknetBtcRelay} from "../btcrelay/StarknetBtcRelay";
import {cairo, constants} from "starknet";
import {StarknetAction} from "../chain/StarknetAction";
import {SpvVaultContractAbi} from "./SpvVaultContractAbi";
import {StarknetSigner} from "../wallet/StarknetSigner";
import {StarknetSpvVaultData} from "./StarknetSpvVaultData";
import {StarknetSpvWithdrawalData} from "./StarknetSpvWithdrawalData";
import {bigNumberishToBuffer, bufferToByteArray, bufferToU32Array, getLogger, toBigInt, toHex} from "../../utils/Utils";
import {StarknetBtcStoredHeader} from "../btcrelay/headers/StarknetBtcStoredHeader";
import {StarknetAddresses} from "../chain/modules/StarknetAddresses";

const spvVaultContractAddreses = {
    [constants.StarknetChainId.SN_SEPOLIA]: "0x03e21276e5d3225630cae514992fefee6c3d146742ab50b93317c61f5260dbaf",
    [constants.StarknetChainId.SN_MAIN]: ""
};

const STARK_PRIME_MOD: bigint = 2n**251n + 17n * 2n**192n + 1n;

function decodeUtxo(utxo: string): {txHash: bigint, vout: bigint} {
    const [txId, vout] = utxo.split(":");
    return {
        txHash: BigInt("0x"+Buffer.from(txId, "hex").reverse().toString("hex")),
        vout: BigInt(vout)
    }
}

export class StarknetSpvVaultContract
    extends StarknetContractBase<typeof SpvVaultContractAbi>
    implements SpvVaultContract<
        StarknetTx,
        StarknetSigner,
        "STARKNET",
        StarknetSpvVaultData,
        StarknetSpvWithdrawalData
    >
{
    private static readonly GasCosts = {
        DEPOSIT: {l1: 750, l2: 0},
        OPEN: {l1: 1500, l2: 0},
        FRONT: {l1: 750, l2: 0},
        CLAIM: {l1: 10000, l2: 0}
    };

    readonly chainId = "STARKNET";

    readonly btcRelay: StarknetBtcRelay<any>;
    readonly bitcoinRpc: BitcoinRpc<any>;
    readonly claimTimeout: number = 180;

    readonly logger = getLogger("StarknetSpvVaultContract: ");

    constructor(
        chainInterface: StarknetChainInterface,
        btcRelay: StarknetBtcRelay<any>,
        bitcoinRpc: BitcoinRpc<any>,
        contractAddress: string = spvVaultContractAddreses[chainInterface.starknetChainId]
    ) {
        super(chainInterface, contractAddress, SpvVaultContractAbi);
        this.btcRelay = btcRelay;
        this.bitcoinRpc = bitcoinRpc;
    }

    //StarknetActions
    protected Open(signer: string, vault: StarknetSpvVaultData): StarknetAction {
        const {txHash, vout} = decodeUtxo(vault.getUtxo());

        const tokens = vault.getTokenData();
        if(tokens.length!==2) throw new Error("Must specify exactly 2 tokens for vault!");

        return new StarknetAction(signer, this.Chain,
            this.contract.populateTransaction.open(
                vault.getVaultId(), this.btcRelay.contract.address,
                cairo.tuple(cairo.uint256(txHash), vout), vault.getConfirmations(),
                tokens[0].token, tokens[1].token, tokens[0].multiplier, tokens[1].multiplier
            ),
            StarknetSpvVaultContract.GasCosts.OPEN
        );
    }

    protected Deposit(signer: string, vault: StarknetSpvVaultData, rawAmounts: bigint[]): StarknetAction {
        return new StarknetAction(signer, this.Chain,
            this.contract.populateTransaction.deposit(vault.getOwner(), vault.getVaultId(), rawAmounts[0], rawAmounts[1] ?? 0n),
            StarknetSpvVaultContract.GasCosts.DEPOSIT
        );
    }

    protected Front(signer: string, vault: StarknetSpvVaultData, data: StarknetSpvWithdrawalData, withdrawalSequence: number) {
        return new StarknetAction(signer, this.Chain,
            this.contract.populateTransaction.front(
                vault.getOwner(), vault.getVaultId(), BigInt(withdrawalSequence),
                data.getTxHash(), data.serializeToStruct()
            ),
            StarknetSpvVaultContract.GasCosts.FRONT
        );
    }

    protected Claim(
        signer: string, vault: StarknetSpvVaultData, data: StarknetSpvWithdrawalData,
        blockheader: StarknetBtcStoredHeader, merkle: Buffer[], position: number
    ) {
        return new StarknetAction(signer, this.Chain,
            {
                contractAddress: this.contract.address,
                entrypoint: "claim",
                calldata: [
                    vault.getOwner(),
                    vault.getVaultId(),
                    ...bufferToByteArray(Buffer.from(data.btcTx.hex, "hex")),
                    ...blockheader.serialize(),
                    merkle.length,
                    merkle.map(val => bufferToU32Array(val)).flat(),
                    position,
                ]
            },
            StarknetSpvVaultContract.GasCosts.CLAIM
        );
    }

    async checkWithdrawalTx(tx: SpvWithdrawalTransactionData): Promise<void> {
        const result = await this.Chain.provider.callContract({
            contractAddress: this.contract.address,
            entrypoint: "parse_bitcoin_tx",
            calldata: bufferToByteArray(Buffer.from(tx.btcTx.hex, "hex"))
        });
        if(result==null) throw new Error("Failed to parse transaction!");
    }

    createVaultData(owner: string, vaultId: bigint, utxo: string, confirmations: number, tokenData: SpvVaultTokenData[]): Promise<StarknetSpvVaultData> {
        if(tokenData.length!==2) throw new Error("Must specify 2 tokens in tokenData!");
        return Promise.resolve(new StarknetSpvVaultData(owner, vaultId, {
            relay_contract: this.btcRelay.contract.address,
            token_0: tokenData[0].token,
            token_1: tokenData[1].token,
            token_0_multiplier: tokenData[0].multiplier,
            token_1_multiplier: tokenData[1].multiplier,
            utxo: cairo.tuple(cairo.uint256(0), 0),
            confirmations: confirmations,
            withdraw_count: 0,
            token_0_amount: 0n,
            token_1_amount: 0n
        }, utxo));
    }

    //Getters
    async getVaultData(owner: string, vaultId: bigint): Promise<StarknetSpvVaultData> {
        const struct = await this.contract.get_vault(owner, vaultId);
        return new StarknetSpvVaultData(owner, vaultId, struct);
    }

    async getWithdrawalState(btcTxId: string): Promise<SpvWithdrawalState> {
        const txHash = Buffer.from(btcTxId, "hex").reverse();
        const txHashU256 = cairo.uint256("0x"+txHash.toString("hex"));
        let result: SpvWithdrawalState = {
            type: SpvWithdrawalStateType.NOT_FOUND
        };
        await this.Events.findInContractEventsForward(
            ["spv_swap_vault::events::Fronted", "spv_swap_vault::events::Claimed", "spv_swap_vault::events::Closed"],
            [
                txHashU256.low.toString(),
                txHashU256.high.toString()
            ],
            async (event) => {
                switch(event.name) {
                    case "spv_swap_vault::events::Fronted":
                        result = {
                            type: SpvWithdrawalStateType.FRONTED,
                            txId: btcTxId,
                            owner: toHex(event.keys[2]),
                            vaultId: toBigInt(event.keys[3]),
                            recipient: toHex(event.keys[4]),
                            fronter: toHex(event.keys[6])
                        };
                        break;
                    case "spv_swap_vault::events::Claimed":
                        result = {
                            type: SpvWithdrawalStateType.CLAIMED,
                            txId: btcTxId,
                            owner: toHex(event.keys[2]),
                            vaultId: toBigInt(event.keys[3]),
                            recipient: toHex(event.keys[4]),
                            claimer: toHex(event.keys[6]),
                            fronter: toHex(event.data[2])
                        };
                        break;
                    case "spv_swap_vault::events::Closed":
                        result = {
                            type: SpvWithdrawalStateType.CLOSED,
                            txId: btcTxId,
                            owner: toHex(event.keys[2]),
                            vaultId: toBigInt(event.keys[3]),
                            error: bigNumberishToBuffer(event.data[0]).toString()
                        }
                        break;
                }
            }
        );
        return result;
    }

    getWithdrawalData(btcTx: BtcTx): Promise<StarknetSpvWithdrawalData> {
        return Promise.resolve(new StarknetSpvWithdrawalData(btcTx));
    }

    //OP_RETURN data encoding/decoding
    fromOpReturnData(data: Buffer): { recipient: string; rawAmounts: bigint[]; executionHash: string } {
        return StarknetSpvVaultContract.fromOpReturnData(data);
    }
    static fromOpReturnData(data: Buffer): { recipient: string; rawAmounts: bigint[]; executionHash: string } {
        let rawAmount0: bigint = 0n;
        let rawAmount1: bigint = 0n;
        let executionHash: string = null;
        if(data.length===40) {
            rawAmount0 = data.readBigInt64LE(32).valueOf();
        } else if(data.length===48) {
            rawAmount0 = data.readBigInt64LE(32).valueOf();
            rawAmount1 = data.readBigInt64LE(40).valueOf();
        } else if(data.length===72) {
            rawAmount0 = data.readBigInt64LE(32).valueOf();
            executionHash = data.slice(40, 72).toString("hex");
        } else if(data.length===80) {
            rawAmount0 = data.readBigInt64LE(32).valueOf();
            rawAmount1 = data.readBigInt64LE(40).valueOf();
            executionHash = data.slice(48, 80).toString("hex");
        } else {
            throw new Error("Invalid OP_RETURN data length!");
        }

        if(executionHash!=null) {
            const executionHashValue = BigInt("0x"+executionHash);
            if(executionHashValue >= STARK_PRIME_MOD) throw new Error("Execution hash not in range of starknet prime");
        }

        const recipient = "0x"+data.slice(0, 32).toString("hex");
        if(!StarknetAddresses.isValidAddress(recipient)) throw new Error("Invalid recipient specified");

        return {executionHash, rawAmounts: [rawAmount0, rawAmount1], recipient};
    }

    toOpReturnData(recipient: string, rawAmounts: bigint[], executionHash?: string): Buffer {
        return StarknetSpvVaultContract.toOpReturnData(recipient, rawAmounts, executionHash);
    }
    static toOpReturnData(recipient: string, rawAmounts: bigint[], executionHash?: string): Buffer {
        if(!StarknetAddresses.isValidAddress(recipient)) throw new Error("Invalid recipient specified");
        if(rawAmounts.length < 1) throw new Error("At least 1 amount needs to be specified");
        if(rawAmounts.length > 2) throw new Error("At most 2 amounts need to be specified");
        rawAmounts.forEach(val => {
            if(val < 0n) throw new Error("Negative raw amount specified");
            if(val >= 2n**64n) throw new Error("Raw amount overflow");
        });
        if(executionHash!=null) {
            const executionHashValue = toBigInt(executionHash);
            if(executionHashValue < 0n) throw new Error("Execution hash negative");
            if(executionHashValue >= STARK_PRIME_MOD) throw new Error("Execution hash not in range of starknet prime");
        }
        const recipientBuffer = Buffer.from(recipient.substring(2).padStart(64, "0"), "hex");
        const amount0Buffer = Buffer.from(rawAmounts[0].toString(16).padStart(16, "0"), "hex");
        const amount1Buffer = rawAmounts[1]==null || rawAmounts[1]===0n ? Buffer.alloc(0) : Buffer.from(rawAmounts[1].toString(16).padStart(16, "0"), "hex");
        const executionHashBuffer = executionHash==null ? Buffer.alloc(0) : Buffer.from(executionHash.substring(2).padStart(64, "0"), "hex");

        return Buffer.concat([
            recipientBuffer,
            amount0Buffer.reverse(),
            amount1Buffer.reverse(),
            executionHashBuffer
        ]);
    }

    //Actions
    async claim(signer: StarknetSigner, vault: StarknetSpvVaultData, tx: StarknetSpvWithdrawalData, storedHeader?: StarknetBtcStoredHeader, synchronizer?: RelaySynchronizer<any, any, any>, initAta?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string> {
        const result = await this.txsClaim(signer.getAddress(), vault, tx, storedHeader, synchronizer, initAta, txOptions?.feeRate);
        const [signature] = await this.Chain.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return signature;
    }

    async deposit(signer: StarknetSigner, vault: StarknetSpvVaultData, rawAmounts: bigint[], txOptions?: TransactionConfirmationOptions): Promise<string> {
        const result = await this.txsDeposit(signer.getAddress(), vault, rawAmounts, txOptions?.feeRate);
        const [signature] = await this.Chain.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return signature;
    }

    async frontLiquidity(signer: StarknetSigner, vault: StarknetSpvVaultData, realWithdrawalTx: StarknetSpvWithdrawalData, withdrawSequence: number, txOptions?: TransactionConfirmationOptions): Promise<string> {
        const result = await this.txsFrontLiquidity(signer.getAddress(), vault, realWithdrawalTx, withdrawSequence, txOptions?.feeRate);
        const [signature] = await this.Chain.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return signature;
    }

    async open(signer: StarknetSigner, vault: StarknetSpvVaultData, txOptions?: TransactionConfirmationOptions): Promise<string> {
        const result = await this.txsOpen(signer.getAddress(), vault, txOptions?.feeRate);
        const [signature] = await this.Chain.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return signature;
    }

    //Transactions
    async txsClaim(
        signer: string, vault: StarknetSpvVaultData, tx: StarknetSpvWithdrawalData,
        storedHeader?: StarknetBtcStoredHeader, synchronizer?: RelaySynchronizer<any, any, any>,
        initAta?: boolean, feeRate?: string
    ): Promise<StarknetTx[]> {
        if(!vault.isOpened()) throw new Error("Cannot claim from a closed vault!");
        feeRate ??= await this.Chain.Fees.getFeeRate();

        const merkleProof = await this.bitcoinRpc.getMerkleProof(tx.btcTx.txid, tx.btcTx.blockhash);
        this.logger.debug("txsClaim(): merkle proof computed: ", merkleProof);

        const txs: StarknetTx[] = [];
        if(storedHeader==null) storedHeader = await StarknetBtcRelay.getCommitedHeaderAndSynchronize(
            signer, this.btcRelay, merkleProof.blockheight, vault.getConfirmations(),
            tx.btcTx.blockhash, txs, synchronizer, feeRate
        );

        if(storedHeader==null) throw new Error("Cannot fetch committed header!");

        const action = this.Claim(signer, vault, tx, storedHeader, merkleProof.merkle, merkleProof.pos);

        this.logger.debug("txsClaim(): claim TX created, owner: "+vault.getOwner()+
            " vaultId: "+vault.getVaultId().toString(10));

        txs.push(await action.tx(feeRate));

        return txs;
    }

    async txsDeposit(signer: string, vault: StarknetSpvVaultData, rawAmounts: bigint[], feeRate?: string): Promise<StarknetTx[]> {
        if(!vault.isOpened()) throw new Error("Cannot deposit to a closed vault!");
        //Approve first
        const vaultTokens = vault.getTokenData();
        const action = new StarknetAction(signer, this.Chain);
        let realAmount0 = 0n;
        let realAmount1 = 0n;
        if(rawAmounts[0]!=null && rawAmounts[0]!==0n) {
            realAmount0 = rawAmounts[0] * vaultTokens[0].multiplier;
            action.add(this.Chain.Tokens.Approve(signer, this.contract.address, vaultTokens[0].token, realAmount0));
        }
        if(rawAmounts[1]!=null && rawAmounts[1]!==0n) {
            realAmount1 = rawAmounts[1] * vaultTokens[1].multiplier;
            action.add(this.Chain.Tokens.Approve(signer, this.contract.address, vaultTokens[1].token, realAmount1));
        }
        action.add(this.Deposit(signer, vault, rawAmounts));

        feeRate ??= await this.Chain.Fees.getFeeRate();

        this.logger.debug("txsDeposit(): deposit TX created,"+
            " token0: "+vaultTokens[0].token+" rawAmount0: "+rawAmounts[0].toString(10)+" amount0: "+realAmount0.toString(10)+
            " token1: "+vaultTokens[1].token+" rawAmount1: "+(rawAmounts[1] ?? 0n).toString(10)+" amount1: "+realAmount1.toString(10));

        return [await action.tx(feeRate)];
    }

    async txsFrontLiquidity(signer: string, vault: StarknetSpvVaultData, realWithdrawalTx: StarknetSpvWithdrawalData, withdrawSequence: number, feeRate?: string): Promise<StarknetTx[]> {
        if(!vault.isOpened()) throw new Error("Cannot front on a closed vault!");

        //Approve first
        const vaultTokens = vault.getTokenData();
        const action = new StarknetAction(signer, this.Chain);
        const rawAmounts = realWithdrawalTx.getFrontingAmount();
        let realAmount0 = 0n;
        let realAmount1 = 0n;
        if(rawAmounts[0]!=null && rawAmounts[0]!==0n) {
            realAmount0 = rawAmounts[0] * vaultTokens[0].multiplier;
            action.add(this.Chain.Tokens.Approve(signer, this.contract.address, vaultTokens[0].token, realAmount0));
        }
        if(rawAmounts[1]!=null && rawAmounts[1]!==0n) {
            realAmount1 = rawAmounts[1] * vaultTokens[1].multiplier;
            action.add(this.Chain.Tokens.Approve(signer, this.contract.address, vaultTokens[1].token, realAmount1));
        }
        action.add(this.Front(signer, vault, realWithdrawalTx, withdrawSequence));

        feeRate ??= await this.Chain.Fees.getFeeRate();

        this.logger.debug("txsFrontLiquidity(): front TX created,"+
            " token0: "+vaultTokens[0].token+" rawAmount0: "+rawAmounts[0].toString(10)+" amount0: "+realAmount0.toString(10)+
            " token1: "+vaultTokens[1].token+" rawAmount1: "+(rawAmounts[1] ?? 0n).toString(10)+" amount1: "+realAmount1.toString(10));

        return [await action.tx(feeRate)];
    }

    async txsOpen(signer: string, vault: StarknetSpvVaultData, feeRate?: string): Promise<StarknetTx[]> {
        if(vault.isOpened()) throw new Error("Cannot open an already opened vault!");

        const action = this.Open(signer, vault);

        feeRate ??= await this.Chain.Fees.getFeeRate();

        this.logger.debug("txsOpen(): open TX created, owner: "+vault.getOwner()+
            " vaultId: "+vault.getVaultId().toString(10));

        return [await action.tx(feeRate)];
    }

}
