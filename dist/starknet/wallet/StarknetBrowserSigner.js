"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetBrowserSigner = void 0;
const StarknetSigner_1 = require("./StarknetSigner");
/**
 * Browser-based Starknet signer, use with browser based signer accounts, this ensures that
 *  no signTransaction calls are made and only sendTransaction is supported!
 *
 * @category Wallets
 */
class StarknetBrowserSigner extends StarknetSigner_1.StarknetSigner {
    constructor(account) {
        super(account, false);
        this.signTransaction = undefined;
    }
}
exports.StarknetBrowserSigner = StarknetBrowserSigner;
