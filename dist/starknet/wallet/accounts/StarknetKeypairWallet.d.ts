import { Account, DeployAccountContractPayload, Provider } from "starknet";
/**
 * Keypair-based wallet implementation using OpenZeppelin Account pattern
 * @category Wallets
 */
export declare class StarknetKeypairWallet extends Account {
    readonly publicKey: string;
    constructor(provider: Provider, privateKey: string);
    getDeploymentData(): DeployAccountContractPayload;
    static generateRandomPrivateKey(): string;
}
