import { StarknetSigner } from "./StarknetSigner";
import { Account } from "starknet";
/**
 * A static message, which should be signed by the Starknet wallets to generate reproducible entropy. Works when
 *  wallets use signing with deterministic nonce, such that signature over the same message always yields the
 *  same signature (same entropy).
 *
 * @category Wallets
 */
export declare const STARKNET_REPRODUCIBLE_ENTROPY_MESSAGE = "Signing this messages generates a reproducible secret to be used on %APPNAME%.";
/**
 * A static message, which should be signed by the Starknet wallets to generate reproducible entropy. Works when
 *  wallets use signing with deterministic nonce, such that signature over the same message always yields the
 *  same signature (same entropy).
 *
 * @category Wallets
 */
export declare const STARKNET_REPRODUCIBLE_ENTROPY_WARNING = "PLEASE DOUBLE CHECK THAT YOU\nARE ON THE %APPNAME% WEBSITE BEFORE SIGNING THE MESSAGE, SIGNING THIS MESSAGE ON ANY OTHER WEBSITE MIGHT LEAD TO\nLOSS OF FUNDS!";
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
