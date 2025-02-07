"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetAccounts = void 0;
const StarknetModule_1 = require("../StarknetModule");
class StarknetAccounts extends StarknetModule_1.StarknetModule {
    getAccountDeployTransaction(deploymentData) {
        return __awaiter(this, void 0, void 0, function* () {
            const details = Object.assign(Object.assign({}, this.root.Fees.getFeeDetails(5000, 0, yield this.root.Fees.getFeeRate())), { walletAddress: deploymentData.contractAddress, cairoVersion: "1", chainId: this.root.starknetChainId, nonce: 0, accountDeploymentData: [], skipValidate: false });
            return {
                type: "DEPLOY_ACCOUNT",
                tx: deploymentData,
                details
            };
        });
    }
}
exports.StarknetAccounts = StarknetAccounts;
