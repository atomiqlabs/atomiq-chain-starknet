import { AbstractSigner } from "@atomiqlabs/base";
import { Account } from "starknet";
export declare class StarknetSigner implements AbstractSigner {
    account: Account;
    isDeployed: boolean;
    constructor(account: Account);
    getPublicKey(): Promise<string>;
    getAddress(): string;
}
