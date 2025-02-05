"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetSigner = void 0;
class StarknetSigner {
    constructor(account) {
        this.isDeployed = null;
        this.account = account;
    }
    getPublicKey() {
        return this.account.signer.getPubKey();
    }
    getAddress() {
        return this.account.address.toString();
    }
}
exports.StarknetSigner = StarknetSigner;
