import {AbstractSigner} from "@atomiqlabs/base";
import {Account, DeployAccountContractPayload, LibraryError} from "starknet";
import {toHex} from "../../utils/Utils";

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
        return toHex(this.account.address);
    }

    isWalletAccount() {
        return (this.account as any).walletProvider!=null;
    }

    async getNonce(): Promise<bigint> {
        try {
            return BigInt(await this.account.getNonceForAddress(this.getAddress()));
        } catch (e) {
            if(e instanceof LibraryError && e.message.includes("20: Contract not found")) {
                return BigInt(0);
            }
            throw e;
        }
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
