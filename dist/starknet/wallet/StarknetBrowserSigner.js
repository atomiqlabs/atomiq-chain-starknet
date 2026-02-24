"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetBrowserSigner = exports.STARKNET_REPRODUCIBLE_ENTROPY_WARNING = exports.STARKNET_REPRODUCIBLE_ENTROPY_MESSAGE = void 0;
const StarknetSigner_1 = require("./StarknetSigner");
const starknet_1 = require("starknet");
const Utils_1 = require("../../utils/Utils");
/**
 * A static message, which should be signed by the Starknet wallets to generate reproducible entropy. Works when
 *  wallets use signing with deterministic nonce, such that signature over the same message always yields the
 *  same signature (same entropy).
 *
 * @category Wallets
 */
exports.STARKNET_REPRODUCIBLE_ENTROPY_MESSAGE = "Signing this messages generates a reproducible secret" +
    " to be used on %APPNAME%.";
/**
 * A static message, which should be signed by the Starknet wallets to generate reproducible entropy. Works when
 *  wallets use signing with deterministic nonce, such that signature over the same message always yields the
 *  same signature (same entropy).
 *
 * @category Wallets
 */
exports.STARKNET_REPRODUCIBLE_ENTROPY_WARNING = "PLEASE DOUBLE CHECK THAT YOU ARE ON THE %APPNAME%" +
    " WEBSITE BEFORE SIGNING THE MESSAGE, SIGNING THIS MESSAGE ON ANY OTHER WEBSITE MIGHT LEAD TO LOSS OF FUNDS!";
const StarknetDomain = [
    { name: 'name', type: 'shortstring' },
    { name: 'version', type: 'shortstring' },
    { name: 'chainId', type: 'shortstring' },
    { name: 'revision', type: 'shortstring' },
];
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
                const message = exports.STARKNET_REPRODUCIBLE_ENTROPY_MESSAGE.replace(new RegExp("%APPNAME%", 'g'), appName);
                const warning = exports.STARKNET_REPRODUCIBLE_ENTROPY_WARNING.replace(new RegExp("%APPNAME%", 'g'), appName);
                const typedData = {
                    types: {
                        StarknetDomain,
                        Message: [
                            { name: 'Message', type: 'string' },
                            { name: 'Warning', type: 'string' }
                        ],
                    },
                    primaryType: 'Message',
                    domain: {
                        name: appName,
                        version: '1',
                        chainId: starknet_1.shortString.decodeShortString(await account.getChainId()),
                        revision: '1'
                    },
                    message: {
                        'Message': message,
                        'Warning': warning
                    }
                };
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
