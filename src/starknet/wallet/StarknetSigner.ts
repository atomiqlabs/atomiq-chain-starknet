import {AbstractSigner} from "@atomiqlabs/base";
import {Account} from "starknet";

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

}
