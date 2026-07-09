import {Account, DeployAccountContractPayload, ec, Provider, TypedData} from "starknet";
import {toHex} from "../../../utils/Utils";

/**
 * Thrown when the target account is not deployed on-chain, so its signature rules can't be checked.
 */
export class AccountNotDeployedError extends Error {
    constructor(readonly address: string) {
        super("Account "+address+" is not deployed on-chain");
        this.name = "AccountNotDeployedError";
        Object.setPrototypeOf(this, AccountNotDeployedError.prototype);
    }
}

/**
 * Thrown when the deployed account rejects a signature from the key (wrong key, or a scheme a single Stark-curve key can't satisfy, e.g. multisig/guardian/secp256r1).
 */
export class WalletVerificationError extends Error {
    constructor(readonly address: string) {
        super("Account "+address+" did not accept a signature from the provided private key");
        this.name = "WalletVerificationError";
        Object.setPrototypeOf(this, WalletVerificationError.prototype);
    }
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
export class DeployedStarkCurveWallet extends Account {

    public readonly publicKey: string;

    /**
     * The constructor does not validate anything. Prefer {@link createAndVerify}, or call
     * {@link verifyWallet} before use — until then the key is not checked to control `address`.
     *
     * @param provider Starknet RPC provider
     * @param privateKey Stark-curve private key of the account, in the 0x... format
     * @param address Address of the **already deployed account**
     */
    constructor(provider: Provider, privateKey: string, address: string) {
        super({provider, address, signer: privateKey, cairoVersion: "1"});
        this.publicKey = ec.starkCurve.getStarkKey(toHex(privateKey));
    }

    /**
     * Always null — wraps an already-deployed account and never self-deploys.
     */
    public getDeploymentData(): DeployAccountContractPayload | null {
        return null;
    }

    /**
     * @throws {@link AccountNotDeployedError} on CONTRACT_NOT_FOUND; other errors (rate limit, network) propagate.
     */
    protected async assertDeployed(): Promise<void> {
        try {
            await this.getClassHashAt(this.address);
        } catch (e: any) {
            const message = ((e?.message ?? "") + (e?.baseError?.message ?? "")).toLowerCase();
            if (message.includes("contract not found") || e?.code === 20 || e?.baseError?.code === 20)
                throw new AccountNotDeployedError(this.address);
            throw e;
        }
    }

    /**
     * A fixed SNIP-12 message — the contents are irrelevant, it only needs to be signed and validated.
     */
    protected async getOwnershipMessage(): Promise<TypedData> {
        return {
            types: {
                StarknetDomain: [
                    {name: 'name', type: 'shortstring'},
                    {name: 'version', type: 'shortstring'},
                    {name: 'chainId', type: 'shortstring'},
                    {name: 'revision', type: 'shortstring'},
                ],
                Verification: [{name: 'action', type: 'shortstring'}],
            },
            primaryType: 'Verification',
            domain: {name: 'DeployedStarkCurveWallet', version: '1', chainId: await this.getChainId(), revision: '1'},
            message: {action: 'Verify wallet ownership'},
        };
    }

    /**
     * Verifies the private key controls the bound account by signing a SNIP-12 message and validating it
     *  against the account's own on-chain `is_valid_signature` — the canonical check, independent of the
     *  account's class hash or signature scheme.
     *
     * @throws {@link AccountNotDeployedError} if the account is not deployed
     * @throws {@link WalletVerificationError} if the account does not accept the key's signature
     */
    public async verifyWallet(): Promise<void> {
        await this.assertDeployed();
        const message = await this.getOwnershipMessage();
        const signature = await this.signMessage(message);
        const valid = await this.verifyMessageInStarknet(message, signature, this.address);
        if (!valid) throw new WalletVerificationError(this.address);
    }

    /**
     * Use this to create a new wallet instance, prefer it over just using the constructor!
     *
     * Constructs the wallet and verifies wallet account ownership (by running {@link verifyWallet}).
     */
    public static async createAndVerify(provider: Provider, privateKey: string, address: string): Promise<DeployedStarkCurveWallet> {
        const wallet = new DeployedStarkCurveWallet(provider, privateKey, address);
        await wallet.verifyWallet();
        return wallet;
    }

}
