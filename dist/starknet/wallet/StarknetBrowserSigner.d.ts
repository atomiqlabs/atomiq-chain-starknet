import { StarknetSigner } from "./StarknetSigner";
import { Account } from "starknet";
/**
 * Browser-based Starknet signer, use with browser based signer accounts, this ensures that
 *  no signTransaction calls are made and only sendTransaction is supported!
 *
 * @category Wallets
 */
export declare class StarknetBrowserSigner extends StarknetSigner {
    private usesECDSADN?;
    getReproducibleEntropy?: (appName: string) => Promise<Buffer>;
    /**
     * @param account Signer account to request signatures and send transaction through
     * @param usesECDSADN Optional flag indicating whether the signer supports signing using ECDSA-DN (deterministic
     *  nonce) algorithm, this allows the wallet to produce reproducible entropy. Only pass `true` here if you are
     *  100% sure that the signer supports this!
     */
    constructor(account: Account, usesECDSADN?: boolean);
}
