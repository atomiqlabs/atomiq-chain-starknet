import {Account, CallData, DeployAccountContractPayload, ec, hash, Provider} from "starknet";
import {toHex} from "../../../utils/Utils";
import {Buffer} from "buffer";

const OZaccountClassHash = '0x00261c293c8084cd79086214176b33e5911677cec55104fddc8d25b0b736dcad';

/**
 * Keypair-based wallet implementation wrapping a starknet.js {@link Account}.
 *
 * A Starknet account's address is a function of its account contract class hash, so the
 * same private key maps to a different address for each wallet vendor (Argent, Braavos,
 * OpenZeppelin, ...). Therefore:
 *
 * - Pass an existing account `address` to bind the wallet to the account the key actually
 *   controls, regardless of its class hash. The wallet uses it as-is and never attempts a
 *   self-deployment. This is the correct option for existing Argent/Braavos/OpenZeppelin
 *   accounts.
 * - Omit `address` to derive and self-deploy a fresh OpenZeppelin account from the key
 *   (see {@link newOpenZeppelinAccount}). Only use this for keys generated for the SDK, as
 *   the derived OpenZeppelin address will not match an existing Argent/Braavos account.
 *
 * @category Wallets
 */
export class StarknetKeypairWallet extends Account {

    public readonly publicKey: string;
    private readonly deploymentData: DeployAccountContractPayload | null;

    /**
     * @param provider Starknet provider
     * @param privateKey Account owner's private key
     * @param address Optional address of an existing account controlled by the key. When
     *  provided, the wallet binds to this account as-is (no OpenZeppelin derivation and no
     *  self-deployment). When omitted, a fresh OpenZeppelin account address is derived from
     *  the key and deployed on first use.
     */
    constructor(provider: Provider, privateKey: string, address?: string) {
        const publicKey = ec.starkCurve.getStarkKey(toHex(privateKey));

        let accountAddress: string;
        let deploymentData: DeployAccountContractPayload | null = null;
        if(address != null) {
            //Bind to the existing account the key controls, regardless of its class hash
            accountAddress = address;
        } else {
            //Derive a fresh OpenZeppelin account address & prepare its deployment payload
            const OZaccountConstructorCallData = CallData.compile({ publicKey });
            accountAddress = hash.calculateContractAddressFromHash(
                publicKey,
                OZaccountClassHash,
                OZaccountConstructorCallData,
                0
            );
            deploymentData = {
                classHash: OZaccountClassHash,
                constructorCalldata: OZaccountConstructorCallData,
                addressSalt: publicKey,
                contractAddress: accountAddress
            };
        }

        super({
            provider,
            address: accountAddress,
            signer: privateKey,
            cairoVersion: "1"
        });
        this.publicKey = publicKey;
        this.deploymentData = deploymentData;
    }

    /**
     * @inheritDoc
     *
     * Returns the OpenZeppelin account deployment payload when this wallet derived its own
     * address, or null when an explicit (already-deployed) account address was provided.
     */
    public getDeploymentData(): DeployAccountContractPayload | null {
        return this.deploymentData;
    }

    /**
     * Constructs a wallet that derives and self-deploys a fresh OpenZeppelin account from
     * the provided private key. Equivalent to omitting the `address` constructor argument.
     *
     * @param provider Starknet provider
     * @param privateKey Account owner's private key
     */
    public static newOpenZeppelinAccount(provider: Provider, privateKey: string): StarknetKeypairWallet {
        return new StarknetKeypairWallet(provider, privateKey);
    }

    /**
     * Generates a random Stark Curve private key for the OZ account
     */
    public static generateRandomPrivateKey(): string {
        return "0x"+Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex");
    }

}
