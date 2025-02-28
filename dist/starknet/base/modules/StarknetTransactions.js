"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetTransactions = void 0;
const StarknetModule_1 = require("../StarknetModule");
const Utils_1 = require("../../../utils/Utils");
class StarknetTransactions extends StarknetModule_1.StarknetModule {
    /**
     * Waits for transaction confirmation using WS subscription and occasional HTTP polling, also re-sends
     *  the transaction at regular interval
     *
     * @param tx starknet transaction to wait for confirmation for & keep re-sending until it confirms
     * @param abortSignal signal to abort waiting for tx confirmation
     * @private
     */
    async confirmTransaction(tx, abortSignal) {
        let state = "pending";
        while (state === "pending" || state === "not_found") {
            await (0, Utils_1.timeoutPromise)(3, abortSignal);
            state = await this.getTxIdStatus(tx.txId);
            if (state === "not_found" && tx.signed != null)
                await this.sendSignedTransaction(tx, undefined, undefined, false).catch(e => {
                    console.error("Error on transaction re-send: ", e);
                });
        }
        if (state === "reverted")
            throw new Error("Transaction reverted!");
    }
    /**
     * Prepares starknet transactions, checks if the account is deployed, assigns nonces if needed & calls beforeTxSigned callback
     *
     * @param signer
     * @param txs
     * @private
     */
    async prepareTransactions(signer, txs) {
        let nonce = await signer.getNonce();
        if (nonce === BigInt(0) && signer.isWalletAccount()) {
            //Just increment the nonce by one and hope the wallet is smart enough to deploy account first
            nonce = BigInt(1);
        }
        const deployPayload = await signer.checkAndGetDeployPayload(nonce);
        if (deployPayload != null) {
            txs.unshift(await this.root.Accounts.getAccountDeployTransaction(deployPayload));
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
            if (this.cbkBeforeTxSigned != null)
                await this.cbkBeforeTxSigned(tx);
        }
    }
    /**
     * Sends out a signed transaction to the RPC
     *
     * @param tx Starknet tx to send
     * @param onBeforePublish a callback called before every transaction is published
     * @param signer
     * @param retryOnSubmissionFailure
     * @private
     */
    async sendSignedTransaction(tx, onBeforePublish, signer, retryOnSubmissionFailure = true) {
        if (onBeforePublish != null)
            await onBeforePublish(tx.txId, await this.serializeTx(tx));
        this.logger.debug("sendSignedTransaction(): sending transaction: ", tx);
        if (tx.signed == null) {
            let txHash;
            switch (tx.type) {
                case "INVOKE":
                    txHash = (await signer.account.execute(tx.tx, tx.details)).transaction_hash;
                    break;
                case "DEPLOY_ACCOUNT":
                    txHash = (await signer.account.deployAccount(tx.tx, tx.details)).transaction_hash;
                    break;
                default:
                    throw new Error("Unsupported tx type!");
            }
            tx.txId = txHash;
            return txHash;
        }
        const txResult = await (0, Utils_1.tryWithRetries)(() => {
            switch (tx.type) {
                case "INVOKE":
                    return this.provider.channel.invoke(tx.signed, tx.details).then(res => res.transaction_hash);
                case "DEPLOY_ACCOUNT":
                    return this.provider.channel.deployAccount(tx.signed, tx.details).then((res) => res.transaction_hash);
                default:
                    throw new Error("Unsupported tx type!");
            }
        }, retryOnSubmissionFailure ? this.retryPolicy : { maxRetries: 1 });
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
        if (!signer.isWalletAccount()) {
            for (let i = 0; i < txs.length; i++) {
                const tx = txs[i];
                switch (tx.type) {
                    case "INVOKE":
                        tx.signed = await signer.account.buildInvocation(tx.tx, tx.details);
                        (0, Utils_1.calculateHash)(tx);
                        break;
                    case "DEPLOY_ACCOUNT":
                        tx.signed = await signer.account.buildAccountDeployPayload(tx.tx, tx.details);
                        (0, Utils_1.calculateHash)(tx);
                        break;
                    default:
                        throw new Error("Unsupported tx type!");
                }
                this.logger.debug("sendAndConfirm(): transaction signed (" + (i + 1) + "/" + txs.length + "): " + tx.txId);
            }
        }
        this.logger.debug("sendAndConfirm(): sending transactions, count: " + txs.length +
            " waitForConfirmation: " + waitForConfirmation + " parallel: " + parallel);
        const txIds = [];
        if (parallel) {
            const promises = [];
            for (let i = 0; i < txs.length; i++) {
                const signedTx = txs[i];
                const txId = await this.sendSignedTransaction(signedTx, onBeforePublish, signer);
                if (waitForConfirmation)
                    promises.push(this.confirmTransaction(signedTx, abortSignal));
                txIds.push(txId);
                this.logger.debug("sendAndConfirm(): transaction sent (" + (i + 1) + "/" + txs.length + "): " + signedTx.txId);
            }
            if (promises.length > 0)
                await Promise.all(promises);
        }
        else {
            for (let i = 0; i < txs.length; i++) {
                const signedTx = txs[i];
                const txId = await this.sendSignedTransaction(signedTx, onBeforePublish, signer);
                const confirmPromise = this.confirmTransaction(signedTx, abortSignal);
                this.logger.debug("sendAndConfirm(): transaction sent (" + (i + 1) + "/" + txs.length + "): " + signedTx.txId);
                //Don't await the last promise when !waitForConfirmation
                if (i < txs.length - 1 || waitForConfirmation)
                    await confirmPromise;
                txIds.push(txId);
            }
        }
        this.logger.info("sendAndConfirm(): sent transactions, count: " + txs.length +
            " waitForConfirmation: " + waitForConfirmation + " parallel: " + parallel);
        return txIds;
    }
    /**
     * Serializes the solana transaction, saves the transaction, signers & last valid blockheight
     *
     * @param tx
     */
    serializeTx(tx) {
        return Promise.resolve(JSON.stringify(tx, (key, value) => {
            if (typeof (value) === "bigint")
                return (0, Utils_1.toHex)(value);
            return value;
        }));
    }
    /**
     * Deserializes saved solana transaction, extracting the transaction, signers & last valid blockheight
     *
     * @param txData
     */
    deserializeTx(txData) {
        return Promise.resolve(JSON.parse(txData));
    }
    /**
     * Gets the status of the raw starknet transaction
     *
     * @param tx
     */
    async getTxStatus(tx) {
        const parsedTx = await this.deserializeTx(tx);
        return await this.getTxIdStatus(parsedTx.txId);
    }
    /**
     * Gets the status of the starknet transaction with a specific txId
     *
     * @param txId
     */
    async getTxIdStatus(txId) {
        const status = await this.provider.getTransactionStatus(txId).catch(e => {
            if (e.message != null && e.message.includes("29: Transaction hash not found"))
                return null;
            throw e;
        });
        if (status == null)
            return "not_found";
        if (status.finality_status === "RECEIVED")
            return "pending";
        if (status.finality_status !== "REJECTED" && status.execution_status === "SUCCEEDED") {
            return "success";
        }
        return "reverted";
    }
    onBeforeTxSigned(callback) {
        this.cbkBeforeTxSigned = callback;
    }
    offBeforeTxSigned(callback) {
        this.cbkBeforeTxSigned = null;
        return true;
    }
}
exports.StarknetTransactions = StarknetTransactions;
