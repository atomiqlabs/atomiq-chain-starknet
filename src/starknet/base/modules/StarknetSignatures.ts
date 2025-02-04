import * as createHash from "create-hash";
import {Buffer} from "buffer";
import {StarknetModule} from "../StarknetModule";
import {StarknetSigner} from "../../wallet/StarknetSigner";
import {
    Account,
    shortString,
    stark,
    StarknetDomain,
    TypedData
} from "starknet";
import {StarknetBase} from "../StarknetBase";

const StarknetDomain = [
    { name: 'name', type: 'shortstring' },
    { name: 'version', type: 'shortstring' },
    { name: 'chainId', type: 'shortstring' },
    { name: 'revision', type: 'shortstring' },
];

const DataHash = [
    { name: 'Data hash', type: 'u256' }
];

export class StarknetSignatures extends StarknetModule {

    private readonly domain: StarknetDomain;

    constructor(root: StarknetBase, domainName: string = "atomiq.exchange") {
        super(root);
        this.domain = {
            name: domainName,
            version: '1',
            chainId: shortString.decodeShortString(root.chainId),
            revision: '1'
        };
    }

    ///////////////////
    //// Data signatures
    private getDataTypedMessage(data: Buffer): TypedData {
        const buff = createHash("sha256").update(data).digest();
        return {
            types: {
                StarknetDomain,
                DataHash,
            },
            primaryType: 'DataHash',
            domain: this.domain,
            message: {"Data hash": "0x"+buff.toString("hex")}
        };
    }

    /**
     * Produces an ed25519 signature over the sha256 of a specified data Buffer, only works with providers which
     *  expose their private key (i.e. backend based, not browser wallet based)
     *
     * @param signer
     * @param data data to sign
     */
    async getDataSignature(signer: StarknetSigner, data: Buffer): Promise<string> {
        const signature = await signer.account.signMessage(this.getDataTypedMessage(data));
        return JSON.stringify(stark.formatSignature(signature));
    }

    /**
     * Checks whether a signature is a valid Ed25519 signature produced by publicKey over a data message (computes
     *  sha256 hash of the message)
     *
     * @param data signed data
     * @param signature data signature
     * @param address public key of the signer
     */
    isValidDataSignature(data: Buffer, signature: string, address: string): Promise<boolean> {
        return new Account(this.provider, address, null).verifyMessage(
            this.getDataTypedMessage(data),
            JSON.parse(signature)
        );
    }

}