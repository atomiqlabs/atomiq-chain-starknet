import { AbstractSigner } from "@atomiqlabs/base";
import { Account, DeployAccountContractPayload } from "starknet";
export declare class StarknetSigner implements AbstractSigner {
    account: Account;
    isDeployed: boolean;
    constructor(account: Account);
    getPublicKey(): Promise<string>;
    getAddress(): string;
    isWalletAccount(): boolean;
    getNonce(): Promise<bigint>;
    checkAndGetDeployPayload(nonce?: bigint): Promise<DeployAccountContractPayload | null>;
}
