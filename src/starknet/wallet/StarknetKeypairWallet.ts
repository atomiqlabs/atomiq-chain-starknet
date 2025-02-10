import {Account, CallData, DeployAccountContractPayload, ec, hash, Provider} from "starknet";
import {Buffer} from "buffer";
import {toHex} from "../../utils/Utils";

const OZaccountClassHash = '0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f';

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
        super(provider, OZcontractAddress, privateKey);
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
