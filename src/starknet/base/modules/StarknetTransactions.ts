import {StarknetModule} from "../StarknetModule";
import {
    Call,
    DeployAccountContractPayload, DeployAccountContractTransaction,
    Invocation, InvocationsSignerDetails,
    BigNumberish
} from "starknet";
import {StarknetSigner} from "../../wallet/StarknetSigner";
import {calculateHash, timeoutPromise, toHex, tryWithRetries} from "../../../utils/Utils";

export type StarknetTx = ({
    type: "DEPLOY_ACCOUNT",
    tx: DeployAccountContractPayload,
    signed?: DeployAccountContractTransaction
} | {
    type: "INVOKE",
    tx: Array<Call>,
    signed?: Invocation
}) & {
    details: InvocationsSignerDetails & {maxFee?: BigNumberish},
    txId?: string
};

export class StarknetTransactions extends StarknetModule {

    private cbkBeforeTxSigned: (tx: StarknetTx) => Promise<void>;

    /**
     * Waits for transaction confirmation using WS subscription and occasional HTTP polling, also re-sends
     *  the transaction at regular interval
     *
     * @param tx starknet transaction to wait for confirmation for & keep re-sending until it confirms
     * @param abortSignal signal to abort waiting for tx confirmation
     * @private
     */
    private async confirmTransaction(tx: StarknetTx, abortSignal?: AbortSignal) {
        let state = "pending";
        while(state==="pending" || state==="not_found") {
            await timeoutPromise(3, abortSignal);
            state = await this.getTxIdStatus(tx.txId);
            //TODO: Maybe re-send on not_found
        }
        if(state==="reverted") throw new Error("Transaction reverted!");
    }

    /**
     * Prepares starknet transactions, checks if the account is deployed, assigns nonces if needed & calls beforeTxSigned callback
     *
     * @param signer
     * @param txs
     * @private
     */
    private async prepareTransactions(signer: StarknetSigner, txs: StarknetTx[]): Promise<void> {
        let nonce: bigint = await signer.getNonce();
        const deployPayload = await signer.checkAndGetDeployPayload(nonce);
        if(deployPayload!=null) {
            txs.unshift(await this.root.Accounts.getAccountDeployTransaction(deployPayload));
        }

        for(let tx of txs) {
            if(tx.details.nonce!=null) nonce = BigInt(tx.details.nonce) + BigInt(1); //Take the nonce from last tx
            if(nonce==null) nonce = BigInt(await this.root.provider.getNonceForAddress(signer.getAddress())); //Fetch the nonce
            if(tx.details.nonce==null) tx.details.nonce = nonce;

            nonce += BigInt(1);

            if(this.cbkBeforeTxSigned!=null) await this.cbkBeforeTxSigned(tx);
        }
    }

    /**
     * Sends out a signed transaction to the RPC
     *
     * @param tx Starknet tx to send
     * @param onBeforePublish a callback called before every transaction is published
     * @private
     */
    private async sendSignedTransaction(tx: StarknetTx, onBeforePublish?: (txId: string, rawTx: string) => Promise<void>): Promise<string> {
        if(onBeforePublish!=null) await onBeforePublish(tx.txId, await this.serializeTx(tx));
        this.logger.debug("sendSignedTransaction(): sending transaction: ", tx);
        const txResult = await tryWithRetries(() => {
            switch(tx.type) {
                case "INVOKE":
                    return this.provider.channel.invoke(tx.signed, tx.details).then(res => res.transaction_hash);
                case "DEPLOY_ACCOUNT":
                    return this.provider.channel.deployAccount(tx.signed, tx.details).then((res: any) => res.transaction_hash);
                default:
                    throw new Error("Unsupported tx type!");
            }
        }, this.retryPolicy);
        if(tx.txId!==txResult) this.logger.warn("sendSignedTransaction(): sent tx hash not matching the precomputed hash!");
        this.logger.info("sendSignedTransaction(): tx sent, expected txHash: "+tx.txId+", txHash: "+txResult);
        return txResult;
    }

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
    public async sendAndConfirm(signer: StarknetSigner, txs: StarknetTx[], waitForConfirmation?: boolean, abortSignal?: AbortSignal, parallel?: boolean, onBeforePublish?: (txId: string, rawTx: string) => Promise<void>): Promise<string[]> {
        await this.prepareTransactions(signer, txs);
        for(let tx of txs) {
            switch(tx.type) {
                case "INVOKE":
                    tx.signed = await signer.account.buildInvocation(tx.tx, tx.details);
                    calculateHash(tx);
                    break;
                case "DEPLOY_ACCOUNT":
                    tx.signed = await signer.account.buildAccountDeployPayload(tx.tx, tx.details);
                    calculateHash(tx);
                    break;
                default:
                    throw new Error("Unsupported tx type!");
            }
        }

        this.logger.debug("sendAndConfirm(): sending transactions, count: "+txs.length+
            " waitForConfirmation: "+waitForConfirmation+" parallel: "+parallel);

        const txIds: string[] = [];
        if(parallel) {
            const promises: Promise<void>[] = [];
            for(let signedTx of txs) {
                const txId = await this.sendSignedTransaction(signedTx, onBeforePublish);
                if(waitForConfirmation) promises.push(this.confirmTransaction(signedTx, abortSignal));
                txIds.push(txId);
            }
            if(promises.length>0) await Promise.all(promises);
        } else {
            for(let i=0;i<txs.length;i++) {
                const signedTx = txs[i];
                const txId = await this.sendSignedTransaction(signedTx, onBeforePublish);
                const confirmPromise = this.confirmTransaction(signedTx, abortSignal);
                //Don't await the last promise when !waitForConfirmation
                if(i<txs.length-1 || waitForConfirmation) await confirmPromise;
                txIds.push(txId);
            }
        }

        this.logger.info("sendAndConfirm(): sent transactions, count: "+txs.length+
            " waitForConfirmation: "+waitForConfirmation+" parallel: "+parallel);

        return txIds;
    }

    /**
     * Serializes the solana transaction, saves the transaction, signers & last valid blockheight
     *
     * @param tx
     */
    public serializeTx(tx: StarknetTx): Promise<string> {
        return Promise.resolve(JSON.stringify(tx, (key, value) => {
            if(typeof(value)==="bigint") return toHex(value);
            return value;
        }));
    }

    /**
     * Deserializes saved solana transaction, extracting the transaction, signers & last valid blockheight
     *
     * @param txData
     */
    public deserializeTx(txData: string): Promise<StarknetTx> {
        return Promise.resolve(JSON.parse(txData));
    }

    /**
     * Gets the status of the raw starknet transaction
     *
     * @param tx
     */
    public async getTxStatus(tx: string): Promise<"pending" | "success" | "not_found" | "reverted"> {
        const parsedTx: StarknetTx = await this.deserializeTx(tx);
        return await this.getTxIdStatus(parsedTx.txId);
    }

    /**
     * Gets the status of the starknet transaction with a specific txId
     *
     * @param txId
     */
    public async getTxIdStatus(txId: string): Promise<"pending" | "success" | "not_found" | "reverted"> {
        const status = await this.provider.getTransactionStatus(txId);
        if(status==null) return "not_found";
        if(status.finality_status==="RECEIVED") return "pending";
        if(status.finality_status!=="REJECTED" && status.execution_status==="SUCCEEDED"){
            return "success";
        }
        return "reverted";
    }

    public onBeforeTxSigned(callback: (tx: StarknetTx) => Promise<void>): void {
        this.cbkBeforeTxSigned = callback;
    }

    public offBeforeTxSigned(callback: (tx: StarknetTx) => Promise<void>): boolean {
        this.cbkBeforeTxSigned = null;
        return true;
    }

}