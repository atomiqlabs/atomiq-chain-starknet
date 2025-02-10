"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetSigner = void 0;
const starknet_1 = require("starknet");
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
    getNonce() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return BigInt(yield this.account.getNonceForAddress(this.getAddress()));
            }
            catch (e) {
                if (e instanceof starknet_1.LibraryError && e.message.includes("20: Contract not found")) {
                    return BigInt(0);
                }
                throw e;
            }
        });
    }
    checkAndGetDeployPayload(nonce) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isDeployed)
                return null;
            const _account = this.account;
            if (_account.getDeploymentData != null) {
                //Check if deployed
                nonce !== null && nonce !== void 0 ? nonce : (nonce = BigInt(yield this.getNonce()));
                this.isDeployed = nonce != BigInt(0);
                if (!this.isDeployed) {
                    return _account.getDeploymentData();
                }
            }
        });
    }
}
exports.StarknetSigner = StarknetSigner;
