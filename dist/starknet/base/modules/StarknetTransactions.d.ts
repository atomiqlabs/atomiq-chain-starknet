import { StarknetModule } from "../StarknetModule";
import { Call, DeployAccountContractPayload, DeployAccountContractTransaction, Invocation, InvocationsSignerDetails, BigNumberish } from "starknet";
import { StarknetSigner } from "../../wallet/StarknetSigner";
export type StarknetTx = ({
    type: "DEPLOY_ACCOUNT";
    tx: DeployAccountContractPayload;
    signed?: DeployAccountContractTransaction;
} | {
    type: "INVOKE";
    tx: Array<Call>;
    signed?: Invocation;
}) & {
    details: InvocationsSignerDetails & {
        maxFee?: BigNumberish;
    };
    txId?: string;
};
export declare class StarknetTransactions extends StarknetModule {
    private cbkBeforeTxSigned;
    /**
     * Waits for transaction confirmation using WS subscription and occasional HTTP polling, also re-sends
     *  the transaction at regular interval
     *
     * @param tx starknet transaction to wait for confirmation for & keep re-sending until it confirms
     * @param abortSignal signal to abort waiting for tx confirmation
     * @private
     */
    private confirmTransaction;
    /**
     * Prepares starknet transactions, checks if the account is deployed, assigns nonces if needed & calls beforeTxSigned callback
     *
     * @param signer
     * @param txs
     * @private
     */
    private prepareTransactions;
    /**
     * Sends out a signed transaction to the RPC
     *
     * @param tx Starknet tx to send
     * @param onBeforePublish a callback called before every transaction is published
     * @private
     */
    private sendSignedTransaction;
    /**
     * Prepares, signs , sends (in parallel or sequentially) & optionally waits for confirmation
     *  of a batch of starknet transactions
     *
     * @param signer
     * @param txs transactions to send
     * @param waitForConfirmation whether to wait for transaction confirmations (this also makes sure the transactions
     *  are re-sent at regular intervals)
     * @param abortSignal abort signal to abort waiting for transaction confirmations
     * @param parallel whether the send all the transaction at once in parallel or sequentially (such that transactions
     *  are executed in order)
     * @param onBeforePublish a callback called before every transaction is published
     */
    sendAndConfirm(signer: StarknetSigner, txs: StarknetTx[], waitForConfirmation?: boolean, abortSignal?: AbortSignal, parallel?: boolean, onBeforePublish?: (txId: string, rawTx: string) => Promise<void>): Promise<string[]>;
    /**
     * Serializes the solana transaction, saves the transaction, signers & last valid blockheight
     *
     * @param tx
     */
    serializeTx(tx: StarknetTx): Promise<string>;
    /**
     * Deserializes saved solana transaction, extracting the transaction, signers & last valid blockheight
     *
     * @param txData
     */
    deserializeTx(txData: string): Promise<StarknetTx>;
    /**
     * Gets the status of the raw starknet transaction
     *
     * @param tx
     */
    getTxStatus(tx: string): Promise<"pending" | "success" | "not_found" | "reverted">;
    /**
     * Gets the status of the starknet transaction with a specific txId
     *
     * @param txId
     */
    getTxIdStatus(txId: string): Promise<"pending" | "success" | "not_found" | "reverted">;
    onBeforeTxSigned(callback: (tx: StarknetTx) => Promise<void>): void;
    offBeforeTxSigned(callback: (tx: StarknetTx) => Promise<void>): boolean;
}
