import {Account, CallData, DeployAccountContractPayload, ec, hash, Provider} from "starknet";
import {toHex} from "../../utils/Utils";

const OZaccountClassHash = '0x066358a3bf5515033abe327a433e2947f9ee8dcd500ccb260f710b47039ebd36';

//Openzeppelin Account wallet
export class StarknetKeypairWallet extends Account {

    public readonly publicKey: string;

    constructor(provider: Provider, privateKey: string) {
        const publicKey = ec.starkCurve.getStarkKey(toHex(privateKey));
        // Calculate future address of the account
        const OZaccountConstructorCallData = CallData.compile({ publicKey });
        const OZcontractAddress = hash.calculateContractAddressFromHash(
            publicKey,
            OZaccountClassHash,
            OZaccountConstructorCallData,
            0
        );
        super(provider, OZcontractAddress, privateKey, "1");
        this.publicKey = publicKey;
    }

    public getDeploymentData(): DeployAccountContractPayload {
        return {
            classHash: OZaccountClassHash,
            constructorCalldata: CallData.compile({ publicKey: this.publicKey }),
            addressSalt: this.publicKey,
            contractAddress: this.address
        }
    }

}
