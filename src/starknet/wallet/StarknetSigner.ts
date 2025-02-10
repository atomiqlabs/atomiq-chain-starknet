import {AbstractSigner} from "@atomiqlabs/base";
import {Account, DeployAccountContractPayload} from "starknet";

export class StarknetSigner implements AbstractSigner {

    account: Account;

    isDeployed: boolean = null;

    constructor(account: Account) {
        this.account = account;
    }

    getPublicKey(): Promise<string> {
        return this.account.signer.getPubKey();
    }

    getAddress(): string {
        return this.account.address.toString();
    }

    async getNonce(): Promise<bigint> {
        return BigInt(await this.account.getNonceForAddress(this.getAddress()));
    }

    async checkAndGetDeployPayload(nonce?: bigint): Promise<DeployAccountContractPayload | null> {
        if(this.isDeployed) return null;

        const _account: Account & {getDeploymentData?: () => DeployAccountContractPayload} = this.account;
        if(_account.getDeploymentData!=null) {
            //Check if deployed
            nonce ??= BigInt(await this.getNonce());
            this.isDeployed = nonce!=BigInt(0);
            if(!this.isDeployed ) {
                return _account.getDeploymentData();
            }
        }
    }

}
