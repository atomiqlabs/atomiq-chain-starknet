import {Provider, constants, stark, ec} from "starknet";
import {getLogger} from "../../utils/Utils";
import {StarknetTransactions, StarknetTx} from "./modules/StarknetTransactions";
import {StarknetFees} from "./modules/StarknetFees";
import {StarknetAddresses} from "./modules/StarknetAddresses";
import {StarknetTokens} from "./modules/StarknetTokens";
import {StarknetEvents} from "./modules/StarknetEvents";
import {StarknetSignatures} from "./modules/StarknetSignatures";
import {StarknetAccounts} from "./modules/StarknetAccounts";
import {StarknetBlocks} from "./modules/StarknetBlocks";
import {ChainInterface, TransactionConfirmationOptions} from "@atomiqlabs/base";
import {StarknetSigner} from "../wallet/StarknetSigner";
import {Buffer} from "buffer";
import {StarknetKeypairWallet} from "../wallet/StarknetKeypairWallet";

export type StarknetRetryPolicy = {
    maxRetries?: number,
    delay?: number,
    exponential?: boolean
}

export class StarknetChainInterface implements ChainInterface {

    readonly chainId = "STARKNET";

    readonly provider: Provider;
    readonly retryPolicy: StarknetRetryPolicy;

    public readonly starknetChainId: constants.StarknetChainId;

    public Fees: StarknetFees;
    public readonly Tokens: StarknetTokens;
    public readonly Transactions: StarknetTransactions;
    public readonly Addresses: StarknetAddresses;
    public readonly Signatures: StarknetSignatures;
    public readonly Events: StarknetEvents;
    public readonly Accounts: StarknetAccounts;
    public readonly Blocks: StarknetBlocks;

    protected readonly logger = getLogger("StarknetChainInterface: ");

    constructor(
        chainId: constants.StarknetChainId,
        provider: Provider,
        retryPolicy?: StarknetRetryPolicy,
        solanaFeeEstimator: StarknetFees = new StarknetFees(provider)
    ) {
        this.starknetChainId = chainId;
        this.provider = provider;
        this.retryPolicy = retryPolicy;

        this.Fees = solanaFeeEstimator;
        this.Tokens = new StarknetTokens(this);
        this.Transactions = new StarknetTransactions(this);
        this.Addresses = new StarknetAddresses(this);

        this.Signatures = new StarknetSignatures(this);
        this.Events = new StarknetEvents(this);
        this.Accounts = new StarknetAccounts(this);
        this.Blocks = new StarknetBlocks(this);
    }

    async getBalance(signer: string, tokenAddress: string): Promise<bigint> {
        //TODO: For native token we should discount the cost of deploying an account if it is not deployed yet
        return await this.Tokens.getTokenBalance(signer, tokenAddress);
    }

    getNativeCurrencyAddress(): string {
        return this.Tokens.getNativeCurrencyAddress();
    }

    isValidAddress(address: string): boolean {
        return this.Addresses.isValidAddress(address);
    }

    ///////////////////////////////////
    //// Callbacks & handlers
    offBeforeTxReplace(callback: (oldTx: string, oldTxId: string, newTx: string, newTxId: string) => Promise<void>): boolean {
        return true;
    }

    onBeforeTxReplace(callback: (oldTx: string, oldTxId: string, newTx: string, newTxId: string) => Promise<void>): void {}

    onBeforeTxSigned(callback: (tx: StarknetTx) => Promise<void>): void {
        this.Transactions.onBeforeTxSigned(callback);
    }

    offBeforeTxSigned(callback: (tx: StarknetTx) => Promise<void>): boolean {
        return this.Transactions.offBeforeTxSigned(callback);
    }

    isValidToken(tokenIdentifier: string): boolean {
        return this.Tokens.isValidToken(tokenIdentifier);
    }

    randomAddress(): string {
        return stark.randomAddress();
    }

    randomSigner(): StarknetSigner {
        const privateKey = "0x"+Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex");
        const wallet = new StarknetKeypairWallet(this.provider, privateKey);
        return new StarknetSigner(wallet);
    }

    ////////////////////////////////////////////
    //// Transactions
    sendAndConfirm(
        signer: StarknetSigner,
        txs: StarknetTx[],
        waitForConfirmation?: boolean,
        abortSignal?: AbortSignal,
        parallel?: boolean,
        onBeforePublish?: (txId: string, rawTx: string) => Promise<void>
    ): Promise<string[]> {
        return this.Transactions.sendAndConfirm(signer, txs, waitForConfirmation, abortSignal, parallel, onBeforePublish);
    }

    serializeTx(tx: StarknetTx): Promise<string> {
        return this.Transactions.serializeTx(tx);
    }

    deserializeTx(txData: string): Promise<StarknetTx> {
        return this.Transactions.deserializeTx(txData);
    }

    getTxIdStatus(txId: string): Promise<"not_found" | "pending" | "success" | "reverted"> {
        return this.Transactions.getTxIdStatus(txId);
    }

    getTxStatus(tx: string): Promise<"not_found" | "pending" | "success" | "reverted"> {
        return this.Transactions.getTxStatus(tx);
    }

    txsTransfer(signer: string, token: string, amount: bigint, dstAddress: string, feeRate?: string): Promise<StarknetTx[]> {
        return this.Tokens.txsTransfer(signer, token, amount, dstAddress, feeRate);
    }

    async transfer(
        signer: StarknetSigner,
        token: string,
        amount: bigint,
        dstAddress: string,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        const txs = await this.Tokens.txsTransfer(signer.getAddress(), token, amount, dstAddress, txOptions?.feeRate);
        const [txId] = await this.Transactions.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal, false);
        return txId;
    }

}
