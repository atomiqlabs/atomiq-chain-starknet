import * as createHash from "create-hash";
import {Buffer} from "buffer";
import {StarknetModule} from "../StarknetModule";
import {StarknetSigner} from "../../wallet/StarknetSigner";
import {
    Account, cairo,
    shortString,
    stark,
    StarknetDomain, StarknetType,
    TypedData
} from "starknet";
import {StarknetBase} from "../StarknetBase";
import {toHex} from "../../../utils/Utils";

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
            chainId: shortString.decodeShortString(root.starknetChainId),
            revision: '1'
        };
    }

    public getTypedMessage(type: StarknetType[], typeName: string, message: object): TypedData {
        return {
            types: {
                StarknetDomain,
                [typeName]: type,
            },
            primaryType: typeName,
            domain: this.domain,
            message
        };
    }

    public async signTypedMessage(signer: StarknetSigner, type: StarknetType[], typeName: string, message: object): Promise<string> {
        const signature = await signer.account.signMessage(this.getTypedMessage(type, typeName, message));
        return JSON.stringify(stark.formatSignature(signature));
    }

    public async isValidSignature(signature: string, address: string, type: StarknetType[], typeName: string, message: object) {
        return new Account(this.provider, address, null).verifyMessage(
            this.getTypedMessage(type, typeName, message),
            JSON.parse(signature)
        )
    }

    ///////////////////
    //// Data signatures
    /**
     * Produces a signature over the sha256 of a specified data Buffer, only works with providers which
     *  expose their private key (i.e. backend based, not browser wallet based)
     *
     * @param signer
     * @param data data to sign
     */
    public getDataSignature(signer: StarknetSigner, data: Buffer): Promise<string> {
        const buff = createHash("sha256").update(data).digest();
        return this.signTypedMessage(signer, DataHash, 'DataHash', {"Data hash": cairo.uint256(toHex(buff))});
    }

    /**
     * Checks whether a signature is a valid signature produced by the account over a data message (computes
     *  sha256 hash of the message)
     *
     * @param data signed data
     * @param signature data signature
     * @param address public key of the signer
     */
    public isValidDataSignature(data: Buffer, signature: string, address: string): Promise<boolean> {
        const buff = createHash("sha256").update(data).digest();
        return this.isValidSignature(signature, address, DataHash, 'DataHash', {"Data hash": cairo.uint256(toHex(buff))});
    }

}