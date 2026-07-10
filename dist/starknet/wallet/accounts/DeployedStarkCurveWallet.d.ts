import { Account, DeployAccountContractPayload, Provider, TypedData } from "starknet";
/**
 * Thrown when the target account is not deployed on-chain, so its signature rules can't be checked.
 */
export declare class AccountNotDeployedError extends Error {
    readonly address: string;
    constructor(address: string);
}
/**
 * Thrown when the deployed account rejects a signature from the key (wrong key, or a scheme a single Stark-curve key can't satisfy, e.g. multisig/guardian/secp256r1).
 */
export declare class WalletVerificationError extends Error {
    readonly address: string;
    constructor(address: string);
}
/**
 * Wallet for an already-deployed Starknet account controlled by a single Stark-curve private key,
 *  bound to an explicit `address` (Starknet addresses depend on the account class hash, so a key
 *  maps to a different address per wallet vendor). Never self-deploys.
 *
 * Use this when bringing in the key from an already deployed wallet account (Braavos, Xverse or Argent/Ready wallets).
 *
 * If you are creating a new wallet consider using {@link StarknetKeypairWallet}.
 *
 * @remarks Prefer {@link createAndVerify}, or call {@link verifyWallet} before use after using the constructor,
 *  these perform an actual check on whether a given key actually controls the wallet account at a given address.
 *
 * @category Wallets
 */
export declare class DeployedStarkCurveWallet extends Account {
    readonly publicKey: string;
    /**
     * The constructor does not validate anything. Prefer {@link createAndVerify}, or call
     * {@link verifyWallet} before use — until then the key is not checked to control `address`.
     *
     * @param provider Starknet RPC provider
     * @param privateKey Stark-curve private key of the account, in the 0x... format
     * @param address Address of the **already deployed account**
     */
    constructor(provider: Provider, privateKey: string, address: string);
    /**
     * Always null — wraps an already-deployed account and never self-deploys.
     */
    getDeploymentData(): DeployAccountContractPayload | null;
    /**
     * @throws {@link AccountNotDeployedError} on CONTRACT_NOT_FOUND; other errors (rate limit, network) propagate.
     */
    protected assertDeployed(): Promise<void>;
    /**
     * A fixed SNIP-12 message — the contents are irrelevant, it only needs to be signed and validated.
     */
    protected getOwnershipMessage(): Promise<TypedData>;
    /**
     * Verifies the private key controls the bound account by signing a SNIP-12 message and validating it
     *  against the account's own on-chain `is_valid_signature` — the canonical check, independent of the
     *  account's class hash or signature scheme.
     *
     * @throws {@link AccountNotDeployedError} if the account is not deployed
     * @throws {@link WalletVerificationError} if the account does not accept the key's signature
     */
    verifyWallet(): Promise<void>;
    /**
     * Use this to create a new wallet instance, prefer it over just using the constructor!
     *
     * Constructs the wallet and verifies wallet account ownership (by running {@link verifyWallet}).
     */
    static createAndVerify(provider: Provider, privateKey: string, address: string): Promise<DeployedStarkCurveWallet>;
}
