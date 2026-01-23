import {Account, CallData, DeployAccountContractPayload, ec, hash, Provider} from "starknet";
import {toHex} from "../../../utils/Utils";
import {Buffer} from "buffer";

const OZaccountClassHash = '0x00261c293c8084cd79086214176b33e5911677cec55104fddc8d25b0b736dcad';

/**
 * Keypair-based wallet implementation using OpenZeppelin Account
 *
 * @category Wallets
 */
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
        super({
            provider,
            address: OZcontractAddress,
            signer: privateKey,
            cairoVersion: "1"
        });
        this.publicKey = publicKey;
    }

    /**
     * @inheritDoc
     */
    public getDeploymentData(): DeployAccountContractPayload {
        return {
            classHash: OZaccountClassHash,
            constructorCalldata: CallData.compile({ publicKey: this.publicKey }),
            addressSalt: this.publicKey,
            contractAddress: this.address
        }
    }

    /**
     * Generates a random Stark Curve private key for the OZ account
     */
    public static generateRandomPrivateKey(): string {
        return "0x"+Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex");
    }

}
