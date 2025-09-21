import {StarknetModule} from "../StarknetModule";
import {
    Call,
    DeployAccountContractPayload, DeployAccountContractTransaction,
    Invocation, InvocationsSignerDetails,
    BigNumberish,
    ETransactionStatus,
    ETransactionExecutionStatus, BlockTag
} from "starknet";
import {StarknetSigner} from "../../wallet/StarknetSigner";
import {timeoutPromise, toHex} from "../../../utils/Utils";

export type StarknetTxBase = {
    details: InvocationsSignerDetails & {maxFee?: BigNumberish},
    txId?: string
};

export type StarknetTxInvoke = StarknetTxBase & {
    type: "INVOKE",
    tx: Array<Call>,
    signed?: Invocation
};

export function isStarknetTxInvoke(obj: any): obj is StarknetTxInvoke {
    return typeof(obj)==="object" &&
        typeof(obj.details)==="object" &&
        (obj.txId==null || typeof(obj.txId)==="string") &&
        obj.type==="INVOKE" &&
        Array.isArray(obj.tx) &&
        (obj.signed==null || typeof(obj.signed)==="object");
}

export type StarknetTxDeployAccount = StarknetTxBase & {
    type: "DEPLOY_ACCOUNT",
    tx: DeployAccountContractPayload,
    signed?: DeployAccountContractTransaction
};

export function isStarknetTxDeployAccount(obj: any): obj is StarknetTxDeployAccount {
    return typeof(obj)==="object" &&
        typeof(obj.details)==="object" &&
        (obj.txId==null || typeof(obj.txId)==="string") &&
        obj.type==="DEPLOY_ACCOUNT" &&
        Array.isArray(obj.tx) &&
        (obj.signed==null || typeof(obj.signed)==="object");
}

export type StarknetTx = StarknetTxInvoke | StarknetTxDeployAccount;

const MAX_UNCONFIRMED_TXS = 25;

export class StarknetTransactions extends StarknetModule {

    private readonly latestConfirmedNonces: {[address: string]: bigint} = {};
    private readonly latestPendingNonces: {[address: string]: bigint} = {};
    private readonly latestSignedNonces: {[address: string]: bigint} = {};

    readonly _cbksBeforeTxReplace: ((oldTx: string, oldTxId: string, newTx: string, newTxId: string) => Promise<void>)[] = [];
    private readonly cbksBeforeTxSigned: ((tx: StarknetTx) => Promise<void>)[] = [];

    readonly _knownTxSet: Set<string> = new Set();

    sendTransaction(tx: StarknetTx): Promise<string> {
        switch(tx.type) {
            case "INVOKE":
                return this.provider.channel.invoke(tx.signed, tx.details).then(res => res.transaction_hash);
            case "DEPLOY_ACCOUNT":
                return this.provider.channel.deployAccount(tx.signed, tx.details).then((res: any) => res.transaction_hash);
            default:
                throw new Error("Unsupported tx type!");
        }
    }

    /**
     * Returns the nonce of the account or 0, if the account is not deployed yet
     *
     * @param address
     * @param blockTag
     */
    async getNonce(address: string, blockTag: BlockTag = BlockTag.PRE_CONFIRMED): Promise<bigint> {
        try {
            return BigInt(await this.provider.getNonceForAddress(address, blockTag));
        } catch (e) {
            if(
                e.baseError?.code === 20 ||
                (e.message!=null && e.message.includes("20: Contract not found"))
            ) {
                return BigInt(0);
            }
            throw e;
        }
    }

    /**
     * Waits for transaction confirmation using WS subscription and occasional HTTP polling, also re-sends
     *  the transaction at regular interval
     *
     * @param tx starknet transaction to wait for confirmation for & keep re-sending until it confirms
     * @param abortSignal signal to abort waiting for tx confirmation
     * @private
     */
    private async confirmTransaction(tx: StarknetTx, abortSignal?: AbortSignal): Promise<string> {
        const checkTxns: Set<string> = new Set([tx.txId]);

        const txReplaceListener = (oldTx: string, oldTxId: string, newTx: string, newTxId: string) => {
            if(checkTxns.has(oldTxId)) checkTxns.add(newTxId);
            return Promise.resolve();
        };
        this.onBeforeTxReplace(txReplaceListener);

        let state = "pending";
        let confirmedTxId: string = null;
        while(state==="pending") {
            await timeoutPromise(3000, abortSignal);
            const latestConfirmedNonce = this.latestConfirmedNonces[toHex(tx.details.walletAddress)];

            const snapshot = [...checkTxns]; //Iterate over a snapshot
            const totalTxnCount = snapshot.length;
            let rejectedTxns = 0;
            let notFoundTxns = 0;
            for(let txId of snapshot) {
                let _state = await this._getTxIdStatus(txId);
                if(_state==="not_found") notFoundTxns++;
                if(_state==="rejected") rejectedTxns++;
                if(_state==="reverted" || _state==="success") {
                    confirmedTxId = txId;
                    state = _state;
                    break;
                }
            }
            if(rejectedTxns===totalTxnCount) { //All rejected
                state = "rejected";
                break;
            }
            if(notFoundTxns===totalTxnCount) { //All not found, check the latest account nonce
                if(latestConfirmedNonce!=null && latestConfirmedNonce>BigInt(tx.details.nonce)) {
                    //Confirmed nonce is already higher than the TX nonce, meaning the TX got replaced
                    throw new Error("Transaction failed - replaced!");
                }
                this.logger.warn("confirmTransaction(): All transactions not found, fetching the latest account nonce...");
                const _latestConfirmedNonce = this.latestConfirmedNonces[toHex(tx.details.walletAddress)];
                const currentLatestNonce = await this.getNonce(tx.details.walletAddress, BlockTag.LATEST);
                if(_latestConfirmedNonce==null || _latestConfirmedNonce < currentLatestNonce) {
                    this.latestConfirmedNonces[toHex(tx.details.walletAddress)] = currentLatestNonce;
                }
            }
        }

        this.offBeforeTxReplace(txReplaceListener);

        if(state==="rejected") throw new Error("Transaction rejected!");

        const nextAccountNonce = BigInt(tx.details.nonce) + 1n;
        const currentConfirmedNonce = this.latestConfirmedNonces[toHex(tx.details.walletAddress)];
        if(currentConfirmedNonce==null || nextAccountNonce > currentConfirmedNonce) {
            this.latestConfirmedNonces[toHex(tx.details.walletAddress)] = nextAccountNonce;
        }
        if(state==="reverted") throw new Error("Transaction reverted!");

        return confirmedTxId;
    }

    /**
     * Prepares starknet transactions, checks if the account is deployed, assigns nonces if needed & calls beforeTxSigned callback
     *
     * @param signer
     * @param txs
     * @private
     */
    private async prepareTransactions(signer: StarknetSigner, txs: StarknetTx[]): Promise<void> {
        let nonce: bigint = await this.getNonce(signer.getAddress());
        const latestPendingNonce = this.latestPendingNonces[toHex(signer.getAddress())];
        if(latestPendingNonce!=null && latestPendingNonce > nonce) {
            this.logger.debug("prepareTransactions(): Using 'pending' nonce from local cache!");
            nonce = latestPendingNonce;
        }

        //Add deploy account tx
        if(nonce===0n) {
            const deployPayload = await signer.getDeployPayload();
            if(deployPayload!=null) txs.unshift(await this.root.Accounts.getAccountDeployTransaction(deployPayload));
        }

        if(!signer.isManagingNoncesInternally) {
            if(nonce===0n) {
                //Just increment the nonce by one and hope the wallet is smart enough to deploy account first
                nonce = 1n;
            }

            for(let i=0;i<txs.length;i++) {
                const tx = txs[i];
                if(tx.details.nonce!=null) nonce = BigInt(tx.details.nonce); //Take the nonce from last tx
                if(nonce==null) nonce = BigInt(await this.root.provider.getNonceForAddress(signer.getAddress())); //Fetch the nonce
                if(tx.details.nonce==null) tx.details.nonce = nonce;

                this.logger.debug("sendAndConfirm(): transaction prepared ("+(i+1)+"/"+txs.length+"), nonce: "+tx.details.nonce);

                nonce += BigInt(1);
            }
        }

        for(let tx of txs) {
            for(let callback of this.cbksBeforeTxSigned) {
                await callback(tx);
            }
        }
    }

    /**
     * Sends out a signed transaction to the RPC
     *
     * @param tx Starknet tx to send
     * @param onBeforePublish a callback called before every transaction is published
     * @private
     */
    private async sendSignedTransaction(
        tx: StarknetTx,
        onBeforePublish?: (txId: string, rawTx: string) => Promise<void>
    ): Promise<string> {
        if(onBeforePublish!=null) await onBeforePublish(tx.txId, StarknetTransactions.serializeTx(tx));
        this.logger.debug("sendSignedTransaction(): sending transaction: ", tx.txId);

        const txResult: string = await this.sendTransaction(tx);
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
        const signedTxs: StarknetTx[] = [];

        //Don't separate the signing process from the sending when using browser-based wallet
        if(signer.signTransaction!=null) for(let i=0;i<txs.length;i++) {
            const tx = txs[i];
            const signedTx = await signer.signTransaction(tx);
            signedTxs.push(signedTx);
            this.logger.debug("sendAndConfirm(): transaction signed ("+(i+1)+"/"+txs.length+"): "+signedTx.txId);

            const nextAccountNonce = BigInt(signedTx.details.nonce) + 1n;
            const currentSignedNonce = this.latestSignedNonces[toHex(signedTx.details.walletAddress)];
            if(currentSignedNonce==null || nextAccountNonce > currentSignedNonce) {
                this.latestSignedNonces[toHex(signedTx.details.walletAddress)] = nextAccountNonce;
            }
        }

        this.logger.debug("sendAndConfirm(): sending transactions, count: "+txs.length+
            " waitForConfirmation: "+waitForConfirmation+" parallel: "+parallel);

        const txIds: string[] = [];
        if(parallel) {
            let promises: Promise<string>[] = [];
            for(let i=0;i<txs.length;i++) {
                let tx: StarknetTx;
                if(signer.signTransaction==null) {
                    const txId = await signer.sendTransaction(txs[i], onBeforePublish);
                    tx = txs[i];
                    tx.txId = txId;
                } else {
                    const signedTx = signedTxs[i];
                    await this.sendSignedTransaction(signedTx, onBeforePublish);
                    tx = signedTx;
                }

                if(tx.details.nonce!=null) {
                    const nextAccountNonce = BigInt(tx.details.nonce) + 1n;
                    const currentPendingNonce = this.latestPendingNonces[toHex(tx.details.walletAddress)];
                    if(currentPendingNonce==null || nextAccountNonce > currentPendingNonce) {
                        this.latestPendingNonces[toHex(tx.details.walletAddress)] = nextAccountNonce;
                    }
                }

                promises.push(this.confirmTransaction(tx, abortSignal));
                if(!waitForConfirmation) txIds.push(tx.txId);
                this.logger.debug("sendAndConfirm(): transaction sent ("+(i+1)+"/"+txs.length+"): "+tx.txId);
                if(promises.length >= MAX_UNCONFIRMED_TXS) {
                    if(waitForConfirmation) txIds.push(...await Promise.all(promises));
                    promises = [];
                }
            }
            if(waitForConfirmation && promises.length>0) {
                txIds.push(...await Promise.all(promises));
            }
        } else {
            for(let i=0;i<txs.length;i++) {
                let tx: StarknetTx;
                if(signer.signTransaction==null) {
                    const txId = await signer.sendTransaction(txs[i], onBeforePublish);
                    tx = txs[i];
                    tx.txId = txId;
                } else {
                    const signedTx = signedTxs[i];
                    await this.sendSignedTransaction(signedTx, onBeforePublish);
                    tx = signedTx;
                }

                if(tx.details.nonce!=null) {
                    const nextAccountNonce = BigInt(tx.details.nonce) + 1n;
                    const currentPendingNonce = this.latestPendingNonces[toHex(tx.details.walletAddress)];
                    if(currentPendingNonce==null || nextAccountNonce > currentPendingNonce) {
                        this.latestPendingNonces[toHex(tx.details.walletAddress)] = nextAccountNonce;
                    }
                }

                const confirmPromise = this.confirmTransaction(tx, abortSignal);
                this.logger.debug("sendAndConfirm(): transaction sent ("+(i+1)+"/"+txs.length+"): "+tx.txId);
                //Don't await the last promise when !waitForConfirmation
                let txHash = tx.txId;
                if(i<txs.length-1 || waitForConfirmation) txHash = await confirmPromise;
                txIds.push(txHash);
            }
        }

        this.logger.info("sendAndConfirm(): sent transactions, count: "+txs.length+
            " waitForConfirmation: "+waitForConfirmation+" parallel: "+parallel);

        return txIds;
    }

    /**
     * Serializes the starknet transaction, saves the transaction, signers & last valid blockheight
     *
     * @param tx
     */
    public static serializeTx(tx: StarknetTx): string {
        return JSON.stringify(tx, (key, value) => {
            if(typeof(value)==="bigint") return {
                _type: "bigint",
                _value: toHex(value)
            };
            return value;
        });
    }

    /**
     * Deserializes saved starknet transaction, extracting the transaction, signers & last valid blockheight
     *
     * @param txData
     */
    public static deserializeTx(txData: string): StarknetTx {
        return JSON.parse(txData, (key, value) => {
            if(typeof(value)==="object" && value._type==="bigint") return BigInt(value._value);
            return value;
        });
    }

    /**
     * Gets the status of the raw starknet transaction
     *
     * @param tx
     */
    public async getTxStatus(tx: string): Promise<"pending" | "success" | "not_found" | "reverted"> {
        const parsedTx: StarknetTx = StarknetTransactions.deserializeTx(tx);
        return await this.getTxIdStatus(parsedTx.txId);
    }

    /**
     * Gets the status of the starknet transaction with a specific txId
     *
     * @param txId
     */
    public async _getTxIdStatus(txId: string): Promise<"pending" | "success" | "not_found" | "reverted" | "rejected"> {
        const status = await this.provider.getTransactionStatus(txId).catch(e => {
            if(
                e.baseError?.code===29 ||
                (e.message!=null && e.message.includes("29: Transaction hash not found"))
            ) return null;
            throw e;
        });
        if(status==null) return this._knownTxSet.has(txId) ? "pending" : "not_found";
        if(status.finality_status===ETransactionStatus.REJECTED) return "rejected";
        if(status.finality_status!==ETransactionStatus.ACCEPTED_ON_L2 && status.finality_status!==ETransactionStatus.ACCEPTED_ON_L1) return "pending";
        if(status.execution_status===ETransactionExecutionStatus.SUCCEEDED){
            return "success";
        }
        return "reverted";
    }

    /**
     * Gets the status of the starknet transaction with a specific txId
     *
     * @param txId
     */
    public async getTxIdStatus(txId: string): Promise<"pending" | "success" | "not_found" | "reverted"> {
        const status = await this._getTxIdStatus(txId);
        if(status==="rejected") return "reverted";
        return status;
    }

    onBeforeTxReplace(callback: (oldTx: string, oldTxId: string, newTx: string, newTxId: string) => Promise<void>): void {
        this._cbksBeforeTxReplace.push(callback);
    }

    offBeforeTxReplace(callback: (oldTx: string, oldTxId: string, newTx: string, newTxId: string) => Promise<void>): boolean {
        const index = this._cbksBeforeTxReplace.indexOf(callback);
        if(index===-1) return false;
        this._cbksBeforeTxReplace.splice(index, 1);
        return true;
    }

    public onBeforeTxSigned(callback: (tx: StarknetTx) => Promise<void>): void {
        this.cbksBeforeTxSigned.push(callback);
    }

    public offBeforeTxSigned(callback: (tx: StarknetTx) => Promise<void>): boolean {
        const index = this.cbksBeforeTxSigned.indexOf(callback);
        if(index===-1) return false;
        this.cbksBeforeTxSigned.splice(index, 1);
        return true;
    }

}