"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetSigner = void 0;
const Utils_1 = require("../../utils/Utils");
class StarknetSigner {
    constructor(account) {
        this.isDeployed = null;
        this.account = account;
    }
    getPublicKey() {
        return this.account.signer.getPubKey();
    }
    getAddress() {
        return (0, Utils_1.toHex)(this.account.address);
    }
    isWalletAccount() {
        return this.account.walletProvider != null;
    }
    //TODO: Introduce proper nonce management!
    async getNonce() {
        try {
            return BigInt(await this.account.getNonceForAddress(this.getAddress(), "pending"));
        }
        catch (e) {
            if (e.message != null && e.message.includes("20: Contract not found")) {
                return BigInt(0);
            }
            throw e;
        }
    }
    async checkAndGetDeployPayload(nonce) {
        if (this.isDeployed)
            return null;
        const _account = this.account;
        if (_account.getDeploymentData != null) {
            //Check if deployed
            nonce ?? (nonce = BigInt(await this.getNonce()));
            this.isDeployed = nonce != BigInt(0);
            if (!this.isDeployed) {
                return _account.getDeploymentData();
            }
        }
        return null;
    }
}
exports.StarknetSigner = StarknetSigner;
