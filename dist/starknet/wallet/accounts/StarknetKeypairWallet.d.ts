import { Account, DeployAccountContractPayload, Provider } from "starknet";
/**
 * Keypair-based wallet implementation using OpenZeppelin Account
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
