import { StarknetSigner } from "./StarknetSigner";
import { StarknetTx } from "../chain/modules/StarknetTransactions";
import { StarknetChainInterface } from "../chain/StarknetChainInterface";
import { Account } from "starknet";
/**
 * Configuration for the persistent signer
 *
 * @category Wallets
 */
export type StarknetPersistentSignerConfig = {
    /**
     * How long to wait for the transaction to confirm before bumping the fee (default 15,000ms = 15s)
     */
    waitBeforeBump?: number;
    /**
     * Minimum fee increment in absolute terms in base units of STRK token (default 1,000,000 = 0.001GFri)
     */
    minFeeIncreaseAbsolute?: bigint;
    /**
     * Minimum fee increase in PPM (parts per million, i.e. 10,000 = 1%) (default 110,000 = 11%)
     */
    minFeeIncreasePpm?: bigint;
    /**
     * Minimum tip increment in absolute terms in base units of STRK token (default 1,000,000,000 = 1GFri)
     */
    minTipIncreaseAbsolute?: bigint;
    /**
     * Minimum tip increase in PPM (parts per million, i.e. 10,000 = 1%) (default 110,000 = 11%)
     */
    minTipIncreasePpm?: bigint;
};
/**
 * A complex starknet signer implementation with internal nonce management, with race condition preventions,
 *  automatic transaction rebroadcasting and failovers. Uses the NodeJS `fs` library to persist transaction
 *  data across application restarts, hence this doesn't work on frontends and is intended to be used as a
 *  robust backend wallet implementation.
 *
 * @category Wallets
 */
export declare class StarknetPersistentSigner extends StarknetSigner {
    private pendingTxs;
    private confirmedNonce;
    private pendingNonce;
    private feeBumper;
    private stopped;
    private readonly directory;
    private readonly config;
    private readonly chainInterface;
    private readonly logger;
    constructor(account: Account, chainInterface: StarknetChainInterface, directory: string, config?: StarknetPersistentSignerConfig);
    private load;
    private priorSavePromise?;
    private saveCount;
    private save;
    private checkPastTransactions;
    private startFeeBumper;
    private syncNonceFromChain;
    /**
     * @inheritDoc
     */
    init(): Promise<void>;
    /**
     * @inheritDoc
     */
    stop(): Promise<void>;
    private readonly sendTransactionQueue;
    /**
     * Signs and sends the starknet transaction, the `onBeforePublish` callback is called after the transaction
     *  is signed and before it is broadcast. Ensures that transactions are always sent in order by using a
     *  "single-threaded" promise queue, and no nonce collision happen.
     *
     * @param transaction A transaction to sign and send
     * @param onBeforePublish A callback that is called before the transaction gets broadcasted
     */
    sendTransaction(transaction: StarknetTx, onBeforePublish?: (txId: string, rawTx: string) => Promise<void>): Promise<string>;
}
