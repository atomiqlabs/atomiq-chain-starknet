"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetBrowserSigner = void 0;
const StarknetSigner_1 = require("./StarknetSigner");
/**
 * Browser-based Starknet signer for external wallet integration
 * @category Wallets
 */
class StarknetBrowserSigner extends StarknetSigner_1.StarknetSigner {
    constructor(account) {
        super(account, false);
        this.signTransaction = undefined;
    }
}
exports.StarknetBrowserSigner = StarknetBrowserSigner;
