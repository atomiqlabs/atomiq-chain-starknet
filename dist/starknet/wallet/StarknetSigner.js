"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetSigner = void 0;
const Utils_1 = require("../../utils/Utils");
const StarknetTransactions_1 = require("../chain/modules/StarknetTransactions");
/**
 * Starknet signer implementation wrapping a starknet.js {@link Account}, for browser
 *  based wallet use {@link StarknetBrowserSigner}
 *
 * @category Wallets
 */
class StarknetSigner {
    constructor(account, isManagingNoncesInternally = false) {
        this.type = "AtomiqAbstractSigner";
        this.account = account;
        this.isManagingNoncesInternally = isManagingNoncesInternally;
    }
    /**
     * @inheritDoc
     */
    getAddress() {
        return (0, Utils_1.toHex)(this.account.address);
    }
    /**
     *
     * @param tx
     * @protected
     */
    async _signTransaction(tx) {
        if ((0, StarknetTransactions_1.isStarknetTxInvoke)(tx)) {
            tx.signed = await this.signInvoke(tx);
        }
        else if ((0, StarknetTransactions_1.isStarknetTxDeployAccount)(tx)) {
            tx.signed = await this.signDeployAccount(tx);
        }
        else {
            throw new Error("Unsupported transaction type!");
        }
        (0, Utils_1.calculateHash)(tx);
        return tx;
    }
    /**
     * Signs the provided starknet transaction and returns its signed version
     *
     * @param tx A starknet transaction to sign
     */
    signTransaction(tx) {
        return this._signTransaction(tx);
    }
    /**
     *
     * @param tx
     * @protected
     */
    signInvoke(tx) {
        return this.account.buildInvocation(tx.tx, tx.details);
    }
    /**
     * @param tx
     * @protected
     */
    signDeployAccount(tx) {
        return this.account.buildAccountDeployPayload(tx.tx, tx.details);
    }
    /**
     * Signs and sends the provided starknet transaction. Note that onBeforePublish is not really called before the
     *  tx is sent out in this default case, since this is not supported by the starknet web based wallets
     *
     * @param tx A transaction to sign and send
     * @param onBeforePublish A callback called after the transaction has been sent
     */
    async sendTransaction(tx, onBeforePublish) {
        if ((0, StarknetTransactions_1.isStarknetTxInvoke)(tx)) {
            tx.txId = await this.sendInvoke(tx);
        }
        else if ((0, StarknetTransactions_1.isStarknetTxDeployAccount)(tx)) {
            tx.txId = await this.sendDeployAccount(tx);
        }
        else {
            throw new Error("Unsupported transaction type!");
        }
        if (onBeforePublish != null)
            await onBeforePublish(tx.txId, StarknetTransactions_1.StarknetTransactions.serializeTx(tx));
        return tx.txId;
    }
    /**
     *
     * @param tx
     * @protected
     */
    async sendInvoke(tx) {
        const result = await this.account.execute(tx.tx, tx.details);
        return result.transaction_hash;
    }
    /**
     *
     * @param tx
     * @protected
     */
    async sendDeployAccount(tx) {
        const result = await this.account.deployAccount(tx.tx, tx.details);
        return result.transaction_hash;
    }
    /**
     * Returns the payload for deploying the signer account's contract on Starknet
     */
    async getDeployPayload() {
        const _account = this.account;
        if (_account.getDeploymentData == null)
            return null;
        return _account.getDeploymentData();
    }
}
exports.StarknetSigner = StarknetSigner;
