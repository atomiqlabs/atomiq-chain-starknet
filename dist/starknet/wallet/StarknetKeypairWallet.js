"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetKeypairWallet = void 0;
const starknet_1 = require("starknet");
const buffer_1 = require("buffer");
const OZaccountClassHash = '0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f';
//Openzeppelin Account wallet
class StarknetKeypairWallet extends starknet_1.Account {
    constructor(provider, privateKey) {
        const publicKey = "0x" + buffer_1.Buffer.from(starknet_1.ec.starkCurve.getPublicKey(privateKey)).toString("hex");
        // Calculate future address of the account
        const OZaccountConstructorCallData = starknet_1.CallData.compile({ publicKey });
        const OZcontractAddress = starknet_1.hash.calculateContractAddressFromHash(publicKey, OZaccountClassHash, OZaccountConstructorCallData, 0);
        super(provider, OZcontractAddress, privateKey);
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
