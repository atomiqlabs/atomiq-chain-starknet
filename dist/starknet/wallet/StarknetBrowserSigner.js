"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetBrowserSigner = void 0;
const StarknetSigner_1 = require("./StarknetSigner");
const Utils_1 = require("../../utils/Utils");
/**
 * Browser-based Starknet signer, use with browser based signer accounts, this ensures that
 *  no signTransaction calls are made and only sendTransaction is supported!
 *
 * @category Wallets
 */
class StarknetBrowserSigner extends StarknetSigner_1.StarknetSigner {
    /**
     * @param account Signer account to request signatures and send transaction through
     * @param usesECDSADN Optional flag indicating whether the signer supports signing using ECDSA-DN (deterministic
     *  nonce) algorithm, this allows the wallet to produce reproducible entropy. Only pass `true` here if you are
     *  100% sure that the signer supports this!
     */
    constructor(account, usesECDSADN) {
        super(account, false);
        this.usesECDSADN = usesECDSADN;
        this.signTransaction = undefined;
        if (this.usesECDSADN !== false) {
            this.getReproducibleEntropy = async (appName) => {
                if (this.usesECDSADN === false)
                    throw new Error("This wallet doesn't support generating recoverable entropy!");
                const typedData = StarknetSigner_1.StarknetSigner.getReproducibleEntropyMessage(await account.getChainId(), appName);
                const signature = await account.signMessage(typedData);
                const serializedSignature = (0, Utils_1.serializeSignature)(signature);
                if (this.usesECDSADN !== true) {
                    const secondSignature = (0, Utils_1.serializeSignature)(await account.signMessage(typedData));
                    if (serializedSignature.length === secondSignature.length &&
                        serializedSignature.every((value, index) => secondSignature[index] === value)) {
                        this.usesECDSADN = true;
                    }
                    else {
                        this.usesECDSADN = false;
                        this.getReproducibleEntropy = undefined;
                        throw new Error("This wallet doesn't support generating recoverable entropy!");
                    }
                }
                return Buffer.concat(serializedSignature.map((value) => (0, Utils_1.bigNumberishToBuffer)(value, 32)));
            };
        }
    }
}
exports.StarknetBrowserSigner = StarknetBrowserSigner;
