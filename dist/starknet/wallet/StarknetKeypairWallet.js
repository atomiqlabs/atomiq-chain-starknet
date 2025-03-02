"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetKeypairWallet = void 0;
const starknet_1 = require("starknet");
const Utils_1 = require("../../utils/Utils");
const OZaccountClassHash = '0x066358a3bf5515033abe327a433e2947f9ee8dcd500ccb260f710b47039ebd36';
//Openzeppelin Account wallet
class StarknetKeypairWallet extends starknet_1.Account {
    constructor(provider, privateKey) {
        const publicKey = starknet_1.ec.starkCurve.getStarkKey((0, Utils_1.toHex)(privateKey));
        // Calculate future address of the account
        const OZaccountConstructorCallData = starknet_1.CallData.compile({ publicKey });
        const OZcontractAddress = starknet_1.hash.calculateContractAddressFromHash(publicKey, OZaccountClassHash, OZaccountConstructorCallData, 0);
        super(provider, OZcontractAddress, privateKey, "1");
        this.publicKey = publicKey;
    }
    getDeploymentData() {
        return {
            classHash: OZaccountClassHash,
            constructorCalldata: starknet_1.CallData.compile({ publicKey: this.publicKey }),
            addressSalt: this.publicKey,
            contractAddress: this.address
        };
    }
}
exports.StarknetKeypairWallet = StarknetKeypairWallet;
