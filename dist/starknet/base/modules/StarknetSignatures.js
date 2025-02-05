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
exports.StarknetSignatures = void 0;
const createHash = require("create-hash");
const StarknetModule_1 = require("../StarknetModule");
const starknet_1 = require("starknet");
const StarknetDomain = [
    { name: 'name', type: 'shortstring' },
    { name: 'version', type: 'shortstring' },
    { name: 'chainId', type: 'shortstring' },
    { name: 'revision', type: 'shortstring' },
];
const DataHash = [
    { name: 'Data hash', type: 'u256' }
];
class StarknetSignatures extends StarknetModule_1.StarknetModule {
    constructor(root, domainName = "atomiq.exchange") {
        super(root);
        this.domain = {
            name: domainName,
            version: '1',
            chainId: starknet_1.shortString.decodeShortString(root.chainId),
            revision: '1'
        };
    }
    ///////////////////
    //// Data signatures
    getDataTypedMessage(data) {
        const buff = createHash("sha256").update(data).digest();
        return {
            types: {
                StarknetDomain,
                DataHash,
            },
            primaryType: 'DataHash',
            domain: this.domain,
            message: { "Data hash": "0x" + buff.toString("hex") }
        };
    }
    /**
     * Produces an ed25519 signature over the sha256 of a specified data Buffer, only works with providers which
     *  expose their private key (i.e. backend based, not browser wallet based)
     *
     * @param signer
     * @param data data to sign
     */
    getDataSignature(signer, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const signature = yield signer.account.signMessage(this.getDataTypedMessage(data));
            return JSON.stringify(starknet_1.stark.formatSignature(signature));
        });
    }
    /**
     * Checks whether a signature is a valid Ed25519 signature produced by publicKey over a data message (computes
     *  sha256 hash of the message)
     *
     * @param data signed data
     * @param signature data signature
     * @param address public key of the signer
     */
    isValidDataSignature(data, signature, address) {
        return new starknet_1.Account(this.provider, address, null).verifyMessage(this.getDataTypedMessage(data), JSON.parse(signature));
    }
}
exports.StarknetSignatures = StarknetSignatures;
