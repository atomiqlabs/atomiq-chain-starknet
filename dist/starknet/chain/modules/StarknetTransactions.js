"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetTransactions = exports.isStarknetTxDeployAccount = exports.isStarknetTxInvoke = void 0;
const StarknetModule_1 = require("../StarknetModule");
const starknet_1 = require("starknet");
const Utils_1 = require("../../../utils/Utils");
function isStarknetTxInvoke(obj) {
    return typeof (obj) === "object" &&
        typeof (obj.details) === "object" &&
        (obj.txId == null || typeof (obj.txId) === "string") &&
        obj.type === "INVOKE" &&
        Array.isArray(obj.tx) &&
        (obj.signed == null || typeof (obj.signed) === "object");
}
exports.isStarknetTxInvoke = isStarknetTxInvoke;
function isStarknetTxDeployAccount(obj) {
    return typeof (obj) === "object" &&
        typeof (obj.details) === "object" &&
        (obj.txId == null || typeof (obj.txId) === "string") &&
        obj.type === "DEPLOY_ACCOUNT" &&
        Array.isArray(obj.tx) &&
        (obj.signed == null || typeof (obj.signed) === "object");
}
exports.isStarknetTxDeployAccount = isStarknetTxDeployAccount;
const MAX_UNCONFIRMED_TXS = 25;
class StarknetTransactions extends StarknetModule_1.StarknetModule {
    constructor() {
        super(...arguments);
        this.latestConfirmedNonces = {};
        this.latestPendingNonces = {};
        this.latestSignedNonces = {};
        this._cbksBeforeTxReplace = [];
        this.cbksBeforeTxSigned = [];
        this._knownTxSet = new Set();
    }
    sendTransaction(tx) {
        switch (tx.type) {
            case "INVOKE":
                return this.provider.channel.invoke(tx.signed, tx.details).then(res => res.transaction_hash);
            case "DEPLOY_ACCOUNT":
                return this.provider.channel.deployAccount(tx.signed, tx.details).then((res) => res.transaction_hash);
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
    async getNonce(address, blockTag = starknet_1.BlockTag.PRE_CONFIRMED) {
        try {
            return BigInt(await this.provider.getNonceForAddress(address, blockTag));
        }
        catch (e) {
            if (e.message != null && e.message.includes("20: Contract not found")) {
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
    async confirmTransaction(tx, abortSignal) {
        const checkTxns = new Set([tx.txId]);
        const txReplaceListener = (oldTx, oldTxId, newTx, newTxId) => {
            if (checkTxns.has(oldTxId))
                checkTxns.add(newTxId);
            return Promise.resolve();
        };
        this.onBeforeTxReplace(txReplaceListener);
        let state = "pending";
        let confirmedTxId = null;
        while (state === "pending" || state === "not_found") {
            await (0, Utils_1.timeoutPromise)(3000, abortSignal);
            for (let txId of checkTxns) {
                //TODO: Rebroadcast latest tx if possible, we might need to do that in case we use 2 different RPCs on the backend
                // as the other one might not have the tx in their mempool
                // if(state==="not_found" && tx.signed!=null) await this.sendSignedTransaction(tx).catch(e => {
                //     if(e.baseError?.code === 59) return; //Transaction already in the mempool
                //     this.logger.error("confirmTransaction(): Error on transaction re-send: ", e);
                // });
                state = await this._getTxIdStatus(txId);
                if (state === "rejected" || state === "reverted" || state === "success") {
                    confirmedTxId = txId;
                    break;
                }
            }
        }
        this.offBeforeTxReplace(txReplaceListener);
        if (state === "rejected")
            throw new Error("Transaction rejected!");
        const nextAccountNonce = (0, Utils_1.toBigInt)(tx.details.nonce) + 1n;
        const currentConfirmedNonce = this.latestConfirmedNonces[(0, Utils_1.toHex)(tx.details.walletAddress)];
        if (currentConfirmedNonce == null || nextAccountNonce > currentConfirmedNonce) {
            this.latestConfirmedNonces[(0, Utils_1.toHex)(tx.details.walletAddress)] = nextAccountNonce;
        }
        if (state === "reverted")
            throw new Error("Transaction reverted!");
        return confirmedTxId;
    }
    /**
     * Prepares starknet transactions, checks if the account is deployed, assigns nonces if needed & calls beforeTxSigned callback
     *
     * @param signer
     * @param txs
     * @private
     */
    async prepareTransactions(signer, txs) {
        let nonce = await this.getNonce(signer.getAddress());
        const latestPendingNonce = this.latestPendingNonces[(0, Utils_1.toHex)(signer.getAddress())];
        if (latestPendingNonce != null && latestPendingNonce > nonce) {
            this.logger.debug("prepareTransactions(): Using 'pending' nonce from local cache!");
            nonce = latestPendingNonce;
        }
        //Add deploy account tx
        if (nonce === 0n) {
            const deployPayload = await signer.getDeployPayload();
            if (deployPayload != null)
                txs.unshift(await this.root.Accounts.getAccountDeployTransaction(deployPayload));
        }
        if (!signer.isManagingNoncesInternally) {
            if (nonce === 0n) {
                //Just increment the nonce by one and hope the wallet is smart enough to deploy account first
                nonce = 1n;
            }
            for (let i = 0; i < txs.length; i++) {
                const tx = txs[i];
                if (tx.details.nonce != null)
                    nonce = BigInt(tx.details.nonce); //Take the nonce from last tx
                if (nonce == null)
                    nonce = BigInt(await this.root.provider.getNonceForAddress(signer.getAddress())); //Fetch the nonce
                if (tx.details.nonce == null)
                    tx.details.nonce = nonce;
                this.logger.debug("sendAndConfirm(): transaction prepared (" + (i + 1) + "/" + txs.length + "), nonce: " + tx.details.nonce);
                nonce += BigInt(1);
            }
        }
        for (let tx of txs) {
            for (let callback of this.cbksBeforeTxSigned) {
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
    async sendSignedTransaction(tx, onBeforePublish) {
        if (onBeforePublish != null)
            await onBeforePublish(tx.txId, StarknetTransactions.serializeTx(tx));
        this.logger.debug("sendSignedTransaction(): sending transaction: ", tx.txId);
        const txResult = await this.sendTransaction(tx);
        if (tx.txId !== txResult)
            this.logger.warn("sendSignedTransaction(): sent tx hash not matching the precomputed hash!");
        this.logger.info("sendSignedTransaction(): tx sent, expected txHash: " + tx.txId + ", txHash: " + txResult);
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
    async sendAndConfirm(signer, txs, waitForConfirmation, abortSignal, parallel, onBeforePublish) {
        await this.prepareTransactions(signer, txs);
        const signedTxs = [];
        //Don't separate the signing process from the sending when using browser-based wallet
        if (signer.signTransaction != null)
            for (let i = 0; i < txs.length; i++) {
                const tx = txs[i];
                const signedTx = await signer.signTransaction(tx);
                signedTxs.push(signedTx);
                this.logger.debug("sendAndConfirm(): transaction signed (" + (i + 1) + "/" + txs.length + "): " + signedTx.txId);
                const nextAccountNonce = BigInt(signedTx.details.nonce) + 1n;
                const currentSignedNonce = this.latestSignedNonces[(0, Utils_1.toHex)(signedTx.details.walletAddress)];
                if (currentSignedNonce == null || nextAccountNonce > currentSignedNonce) {
                    this.latestSignedNonces[(0, Utils_1.toHex)(signedTx.details.walletAddress)] = nextAccountNonce;
                }
            }
        this.logger.debug("sendAndConfirm(): sending transactions, count: " + txs.length +
            " waitForConfirmation: " + waitForConfirmation + " parallel: " + parallel);
        const txIds = [];
        if (parallel) {
            let promises = [];
            for (let i = 0; i < txs.length; i++) {
                let tx;
                if (signer.signTransaction == null) {
                    const txId = await signer.sendTransaction(txs[i], onBeforePublish);
                    tx = txs[i];
                    tx.txId = txId;
                }
                else {
                    const signedTx = signedTxs[i];
                    await this.sendSignedTransaction(signedTx, onBeforePublish);
                    tx = signedTx;
                }
                if (tx.details.nonce != null) {
                    const nextAccountNonce = BigInt(tx.details.nonce) + 1n;
                    const currentPendingNonce = this.latestPendingNonces[(0, Utils_1.toHex)(tx.details.walletAddress)];
                    if (currentPendingNonce == null || nextAccountNonce > currentPendingNonce) {
                        this.latestPendingNonces[(0, Utils_1.toHex)(tx.details.walletAddress)] = nextAccountNonce;
                    }
                }
                promises.push(this.confirmTransaction(tx, abortSignal));
                if (!waitForConfirmation)
                    txIds.push(tx.txId);
                this.logger.debug("sendAndConfirm(): transaction sent (" + (i + 1) + "/" + txs.length + "): " + tx.txId);
                if (promises.length >= MAX_UNCONFIRMED_TXS) {
                    if (waitForConfirmation)
                        txIds.push(...await Promise.all(promises));
                    promises = [];
                }
            }
            if (waitForConfirmation && promises.length > 0) {
                txIds.push(...await Promise.all(promises));
            }
        }
        else {
            for (let i = 0; i < txs.length; i++) {
                let tx;
                if (signer.signTransaction == null) {
                    const txId = await signer.sendTransaction(txs[i], onBeforePublish);
                    tx = txs[i];
                    tx.txId = txId;
                }
                else {
                    const signedTx = signedTxs[i];
                    await this.sendSignedTransaction(signedTx, onBeforePublish);
                    tx = signedTx;
                }
                if (tx.details.nonce != null) {
                    const nextAccountNonce = BigInt(tx.details.nonce) + 1n;
                    const currentPendingNonce = this.latestPendingNonces[(0, Utils_1.toHex)(tx.details.walletAddress)];
                    if (currentPendingNonce == null || nextAccountNonce > currentPendingNonce) {
                        this.latestPendingNonces[(0, Utils_1.toHex)(tx.details.walletAddress)] = nextAccountNonce;
                    }
                }
                const confirmPromise = this.confirmTransaction(tx, abortSignal);
                this.logger.debug("sendAndConfirm(): transaction sent (" + (i + 1) + "/" + txs.length + "): " + tx.txId);
                //Don't await the last promise when !waitForConfirmation
                let txHash = tx.txId;
                if (i < txs.length - 1 || waitForConfirmation)
                    txHash = await confirmPromise;
                txIds.push(txHash);
            }
        }
        this.logger.info("sendAndConfirm(): sent transactions, count: " + txs.length +
            " waitForConfirmation: " + waitForConfirmation + " parallel: " + parallel);
        return txIds;
    }
    /**
     * Serializes the starknet transaction, saves the transaction, signers & last valid blockheight
     *
     * @param tx
     */
    static serializeTx(tx) {
        return JSON.stringify(tx, (key, value) => {
            if (typeof (value) === "bigint")
                return {
                    _type: "bigint",
                    _value: (0, Utils_1.toHex)(value)
                };
            return value;
        });
    }
    /**
     * Deserializes saved starknet transaction, extracting the transaction, signers & last valid blockheight
     *
     * @param txData
     */
    static deserializeTx(txData) {
        return JSON.parse(txData, (key, value) => {
            if (typeof (value) === "object" && value._type === "bigint")
                return BigInt(value._value);
            return value;
        });
    }
    /**
     * Gets the status of the raw starknet transaction
     *
     * @param tx
     */
    async getTxStatus(tx) {
        const parsedTx = StarknetTransactions.deserializeTx(tx);
        return await this.getTxIdStatus(parsedTx.txId);
    }
    /**
     * Gets the status of the starknet transaction with a specific txId
     *
     * @param txId
     */
    async _getTxIdStatus(txId) {
        const status = await this.provider.getTransactionStatus(txId).catch(e => {
            if (e.message != null && e.message.includes("29: Transaction hash not found"))
                return null;
            throw e;
        });
        if (status == null)
            return this._knownTxSet.has(txId) ? "pending" : "not_found";
        if (status.finality_status === starknet_1.ETransactionStatus.REJECTED)
            return "rejected";
        if (status.finality_status !== starknet_1.ETransactionStatus.ACCEPTED_ON_L2 && status.finality_status !== starknet_1.ETransactionStatus.ACCEPTED_ON_L1)
            return "pending";
        if (status.execution_status === starknet_1.ETransactionExecutionStatus.SUCCEEDED) {
            return "success";
        }
        return "reverted";
    }
    /**
     * Gets the status of the starknet transaction with a specific txId
     *
     * @param txId
     */
    async getTxIdStatus(txId) {
        const status = await this._getTxIdStatus(txId);
        if (status === "rejected")
            return "reverted";
        return status;
    }
    onBeforeTxReplace(callback) {
        this._cbksBeforeTxReplace.push(callback);
    }
    offBeforeTxReplace(callback) {
        const index = this._cbksBeforeTxReplace.indexOf(callback);
        if (index === -1)
            return false;
        this._cbksBeforeTxReplace.splice(index, 1);
        return true;
    }
    onBeforeTxSigned(callback) {
        this.cbksBeforeTxSigned.push(callback);
    }
    offBeforeTxSigned(callback) {
        const index = this.cbksBeforeTxSigned.indexOf(callback);
        if (index === -1)
            return false;
        this.cbksBeforeTxSigned.splice(index, 1);
        return true;
    }
}
exports.StarknetTransactions = StarknetTransactions;
