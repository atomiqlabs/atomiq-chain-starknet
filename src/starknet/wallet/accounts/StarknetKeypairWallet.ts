import {Account, CallData, DeployAccountContractPayload, ec, hash, Provider} from "starknet";
import {toHex} from "../../../utils/Utils";
import {Buffer} from "buffer";

const OZaccountClassHash = '0x00261c293c8084cd79086214176b33e5911677cec55104fddc8d25b0b736dcad';

/**
 * A simple keypair-based wallet implementation with a single key and not-upgradable, uses OpenZeppelin Account.
 * Use this only for new keypair-based wallets which don't require additional features such as guardians, multisigs
 *  or upgradability.
 *
 * @remarks Don't use this for already deployed existing wallet account (Braavos, Xverse, Argent/Ready), as it will
 *  result in a different address even when used with the same key (this is because Starknet has native account
 *  abstraction capabilities and you need a correct combination of account type + key). For already deployed wallet
 *  accounts consider using {@link DeployedStarkCurveWallet} instead!
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
