import { Provider, constants, Account, WebSocketChannel } from "starknet";
import { SignedStarknetTx, StarknetTransactions, StarknetTx } from "./modules/StarknetTransactions";
import { StarknetFees } from "./modules/StarknetFees";
import { StarknetTokens } from "./modules/StarknetTokens";
import { StarknetEvents } from "./modules/StarknetEvents";
import { StarknetSignatures } from "./modules/StarknetSignatures";
import { StarknetAccounts } from "./modules/StarknetAccounts";
import { StarknetBlocks } from "./modules/StarknetBlocks";
import { BitcoinNetwork, ChainInterface, TransactionConfirmationOptions } from "@atomiqlabs/base";
import { StarknetSigner } from "../wallet/StarknetSigner";
/**
 * Configuration options for Starknet chain interface
 *
 * @category Chain Interface
 */
export type StarknetConfig = {
    /**
     * Limit of the number of events retrieved by a single `starknet_getEvents` RPC call.
     *
     * Defaults to 100 events
     */
    getLogChunkSize?: number;
    /**
     * When fetching events in the forward direction, sets the limit on the number of blocks
     *  to fetch in a single `starknet_getEvents` RPC call.
     *
     * Defaults to 2000 blocks
     */
    getLogForwardBlockRange?: number;
    /**
     * Maximum numbers of keys allowed to be specified in a single `starknet_getEvents` RPC call
     *
     * Defaults to 64 keys
     */
    maxGetLogKeys?: number;
    /**
     * Maximum number of parallel contract calls to execute in batch functions
     */
    maxParallelCalls?: number;
};
/**
 * Main chain interface for interacting with Starknet blockchain
 *
 * @category Chain Interface
 */
export declare class StarknetChainInterface implements ChainInterface<StarknetTx, SignedStarknetTx, StarknetSigner, "STARKNET", Account> {
    readonly chainId = "STARKNET";
    readonly starknetChainId: constants.StarknetChainId;
    /**
     * Optional websocket channel for instant notifications
     * @internal
     */
    readonly wsChannel?: WebSocketChannel;
    /**
     * Underlying starknet.js provider
     * @internal
     */
    readonly provider: Provider;
    Fees: StarknetFees;
    readonly Tokens: StarknetTokens;
    readonly Transactions: StarknetTransactions;
    readonly Signatures: StarknetSignatures;
    readonly Events: StarknetEvents;
    readonly Accounts: StarknetAccounts;
    readonly Blocks: StarknetBlocks;
    readonly config: StarknetConfig;
    private readonly bitcoinNetwork?;
    constructor(chainId: constants.StarknetChainId, provider: Provider, wsChannel?: WebSocketChannel, feeEstimator?: StarknetFees, options?: StarknetConfig, bitcoinNetwork?: BitcoinNetwork);
    /**
     * @inheritDoc
     */
    getBalance(signer: string, tokenAddress: string): Promise<bigint>;
    /**
     * @inheritDoc
     */
    getNativeCurrencyAddress(): string;
    /**
     * @inheritDoc
     */
    isValidToken(tokenIdentifier: string): boolean;
    /**
     * @inheritDoc
     */
    isValidAddress(address: string, lenient?: boolean): boolean;
    /**
     * @inheritDoc
     */
    normalizeAddress(address: string): string;
    /**
     * @inheritDoc
     */
    offBeforeTxReplace(callback: (oldTx: string, oldTxId: string, newTx: string, newTxId: string) => Promise<void>): boolean;
    /**
     * @inheritDoc
     */
    onBeforeTxReplace(callback: (oldTx: string, oldTxId: string, newTx: string, newTxId: string) => Promise<void>): void;
    /**
     * @inheritDoc
     */
    onBeforeTxSigned(callback: (tx: StarknetTx) => Promise<void>): void;
    /**
     * @inheritDoc
     */
    offBeforeTxSigned(callback: (tx: StarknetTx) => Promise<void>): boolean;
    /**
     * @inheritDoc
     */
    randomAddress(): string;
    /**
     * @inheritDoc
     */
    randomSigner(): StarknetSigner;
    /**
     * @inheritDoc
     */
    sendAndConfirm(signer: StarknetSigner, txs: StarknetTx[], waitForConfirmation?: boolean, abortSignal?: AbortSignal, parallel?: boolean, onBeforePublish?: (txId: string, rawTx: string) => Promise<void>): Promise<string[]>;
    /**
     * @inheritDoc
     */
    sendSignedAndConfirm(signedTxs: SignedStarknetTx[], waitForConfirmation?: boolean, abortSignal?: AbortSignal, parallel?: boolean, onBeforePublish?: (txId: string, rawTx: string) => Promise<void>): Promise<string[]>;
    /**
     * @inheritDoc
     */
    prepareTxs(txs: StarknetTx[]): Promise<StarknetTx[]>;
    /**
     * @inheritDoc
     */
    serializeTx(tx: StarknetTx): Promise<string>;
    /**
     * @inheritDoc
     */
    deserializeTx(txData: string): Promise<StarknetTx>;
    /**
     * @inheritDoc
     */
    serializeSignedTx(signedTx: SignedStarknetTx): Promise<string>;
    /**
     * @inheritDoc
     */
    deserializeSignedTx(txData: string): Promise<SignedStarknetTx>;
    /**
     * @inheritDoc
     */
    getTxIdStatus(txId: string): Promise<"not_found" | "pending" | "success" | "reverted">;
    /**
     * @inheritDoc
     */
    getTxStatus(tx: string): Promise<"not_found" | "pending" | "success" | "reverted">;
    /**
     * @inheritDoc
     */
    getFinalizedBlock(): Promise<{
        height: number;
        blockHash: string;
    }>;
    /**
     * @inheritDoc
     */
    txsTransfer(signer: string, token: string, amount: bigint, dstAddress: string, feeRate?: string): Promise<StarknetTx[]>;
    /**
     * @inheritDoc
     */
    transfer(signer: StarknetSigner, token: string, amount: bigint, dstAddress: string, txOptions?: TransactionConfirmationOptions): Promise<string>;
    /**
     * @inheritDoc
     */
    wrapSigner(signer: Account): Promise<StarknetSigner>;
    verifyNetwork(bitcoinNetwork: BitcoinNetwork): Promise<void>;
}
