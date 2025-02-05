/// <reference types="node" />
import { Buffer } from "buffer";
import { StarknetModule } from "../StarknetModule";
import { StarknetSigner } from "../../wallet/StarknetSigner";
import { StarknetBase } from "../StarknetBase";
export declare class StarknetSignatures extends StarknetModule {
    private readonly domain;
    constructor(root: StarknetBase, domainName?: string);
    private getDataTypedMessage;
    /**
     * Produces an ed25519 signature over the sha256 of a specified data Buffer, only works with providers which
     *  expose their private key (i.e. backend based, not browser wallet based)
     *
     * @param signer
     * @param data data to sign
     */
    getDataSignature(signer: StarknetSigner, data: Buffer): Promise<string>;
    /**
     * Checks whether a signature is a valid Ed25519 signature produced by publicKey over a data message (computes
     *  sha256 hash of the message)
     *
     * @param data signed data
     * @param signature data signature
     * @param address public key of the signer
     */
    isValidDataSignature(data: Buffer, signature: string, address: string): Promise<boolean>;
}
