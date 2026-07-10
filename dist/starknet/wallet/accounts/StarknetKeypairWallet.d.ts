import { Account, DeployAccountContractPayload, Provider } from "starknet";
/**
 * A simple keypair-based wallet implementation with a single key and not-upgradable, uses OpenZeppelin Account.
 * Use this only for new keypair-based wallets which don't require additional features such as guardians, multisigs
 *  or upgradability.
 *
 * @remarks Don't use this for already deployed existing wallet account (Braavos, Xverse, Argent/Ready), as it will
 *  result in a different address even when used with the same key (this is because Starknet has native account
 *  abstraction capabilities and you need a correct combination of account type + key). For already deployed wallet
 *  accounts consider using {@link DeployedStarkCurveWallet} instead!
 *
 * @category Wallets
 */
export declare class StarknetKeypairWallet extends Account {
    readonly publicKey: string;
    constructor(provider: Provider, privateKey: string);
    /**
     * @inheritDoc
     */
    getDeploymentData(): DeployAccountContractPayload;
    /**
     * Generates a random Stark Curve private key for the OZ account
     */
    static generateRandomPrivateKey(): string;
}
