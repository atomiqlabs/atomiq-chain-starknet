import { Provider, constants } from "starknet";
import { StarknetTransactions, StarknetTx } from "./modules/StarknetTransactions";
import { StarknetFees } from "./modules/StarknetFees";
import { StarknetAddresses } from "./modules/StarknetAddresses";
import { StarknetTokens } from "./modules/StarknetTokens";
import { StarknetEvents } from "./modules/StarknetEvents";
import { StarknetSignatures } from "./modules/StarknetSignatures";
import { StarknetAccounts } from "./modules/StarknetAccounts";
import { StarknetBlocks } from "./modules/StarknetBlocks";
import { ChainInterface, TransactionConfirmationOptions } from "@atomiqlabs/base";
import { StarknetSigner } from "../wallet/StarknetSigner";
export type StarknetRetryPolicy = {
    maxRetries?: number;
    delay?: number;
    exponential?: boolean;
};
export declare class StarknetChainInterface implements ChainInterface {
    readonly provider: Provider;
    readonly retryPolicy: StarknetRetryPolicy;
    readonly starknetChainId: constants.StarknetChainId;
    Fees: StarknetFees;
    readonly Tokens: StarknetTokens;
    readonly Transactions: StarknetTransactions;
    readonly Addresses: StarknetAddresses;
    readonly Signatures: StarknetSignatures;
    readonly Events: StarknetEvents;
    readonly Accounts: StarknetAccounts;
    readonly Blocks: StarknetBlocks;
    protected readonly logger: {
        debug: (msg: any, ...args: any[]) => void;
        info: (msg: any, ...args: any[]) => void;
        warn: (msg: any, ...args: any[]) => void;
        error: (msg: any, ...args: any[]) => void;
    };
    constructor(chainId: constants.StarknetChainId, provider: Provider, retryPolicy?: StarknetRetryPolicy, solanaFeeEstimator?: StarknetFees);
    readonly chainId: string;
    getBalance(signer: string, tokenAddress: string): Promise<bigint>;
    getNativeCurrencyAddress(): string;
    isValidAddress(address: string): boolean;
    offBeforeTxReplace(callback: (oldTx: string, oldTxId: string, newTx: string, newTxId: string) => Promise<void>): boolean;
    onBeforeTxReplace(callback: (oldTx: string, oldTxId: string, newTx: string, newTxId: string) => Promise<void>): void;
    isValidToken(tokenIdentifier: string): boolean;
    randomAddress(): string;
    randomSigner(): StarknetSigner;
    sendAndConfirm(signer: StarknetSigner, txs: StarknetTx[], waitForConfirmation?: boolean, abortSignal?: AbortSignal, parallel?: boolean, onBeforePublish?: (txId: string, rawTx: string) => Promise<void>): Promise<string[]>;
    serializeTx(tx: StarknetTx): Promise<string>;
    deserializeTx(txData: string): Promise<StarknetTx>;
    getTxIdStatus(txId: string): Promise<"not_found" | "pending" | "success" | "reverted">;
    getTxStatus(tx: string): Promise<"not_found" | "pending" | "success" | "reverted">;
    txsTransfer(signer: string, token: string, amount: bigint, dstAddress: string, feeRate?: string): Promise<StarknetTx[]>;
    transfer(signer: StarknetSigner, token: string, amount: bigint, dstAddress: string, txOptions?: TransactionConfirmationOptions): Promise<string>;
}
