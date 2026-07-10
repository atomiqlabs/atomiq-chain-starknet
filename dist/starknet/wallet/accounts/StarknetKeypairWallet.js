"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetKeypairWallet = void 0;
const starknet_1 = require("starknet");
const Utils_1 = require("../../../utils/Utils");
const buffer_1 = require("buffer");
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
class StarknetKeypairWallet extends starknet_1.Account {
    constructor(provider, privateKey) {
        const publicKey = starknet_1.ec.starkCurve.getStarkKey((0, Utils_1.toHex)(privateKey));
        // Calculate future address of the account
        const OZaccountConstructorCallData = starknet_1.CallData.compile({ publicKey });
        const OZcontractAddress = starknet_1.hash.calculateContractAddressFromHash(publicKey, OZaccountClassHash, OZaccountConstructorCallData, 0);
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
    getDeploymentData() {
        return {
            classHash: OZaccountClassHash,
            constructorCalldata: starknet_1.CallData.compile({ publicKey: this.publicKey }),
            addressSalt: this.publicKey,
            contractAddress: this.address
        };
    }
    /**
     * Generates a random Stark Curve private key for the OZ account
     */
    static generateRandomPrivateKey() {
        return "0x" + buffer_1.Buffer.from(starknet_1.ec.starkCurve.utils.randomPrivateKey()).toString("hex");
    }
}
exports.StarknetKeypairWallet = StarknetKeypairWallet;
