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
exports.StarknetAction = void 0;
const Utils_1 = require("../../utils/Utils");
class StarknetAction {
    constructor(mainSigner, root, instructions = [], gasLimit, feeRate) {
        var _a, _b;
        this.mainSigner = mainSigner;
        this.root = root;
        this.instructions = Array.isArray(instructions) ? instructions : [instructions];
        this.L1GasLimit = (_a = gasLimit === null || gasLimit === void 0 ? void 0 : gasLimit.l1) !== null && _a !== void 0 ? _a : 0;
        this.L2GasLimit = (_b = gasLimit === null || gasLimit === void 0 ? void 0 : gasLimit.l2) !== null && _b !== void 0 ? _b : 0;
        this.feeRate = feeRate;
    }
    estimateFeeRate() {
        return this.root.Fees.getFeeRate();
    }
    addIx(instruction, gasLimit) {
        var _a, _b;
        this.instructions.push(instruction);
        this.L1GasLimit += (_a = gasLimit === null || gasLimit === void 0 ? void 0 : gasLimit.l1) !== null && _a !== void 0 ? _a : 0;
        this.L2GasLimit += (_b = gasLimit === null || gasLimit === void 0 ? void 0 : gasLimit.l2) !== null && _b !== void 0 ? _b : 0;
    }
    add(action) {
        return this.addAction(action);
    }
    addAction(action, index = this.instructions.length) {
        if (action.mainSigner !== this.mainSigner)
            throw new Error("Actions need to have the same signer!");
        if (this.L1GasLimit == null && action.L1GasLimit != null)
            this.L1GasLimit = action.L1GasLimit;
        if (this.L2GasLimit == null && action.L2GasLimit != null)
            this.L2GasLimit = action.L2GasLimit;
        if (this.L1GasLimit != null && action.L1GasLimit != null)
            this.L1GasLimit += action.L1GasLimit;
        if (this.L2GasLimit != null && action.L2GasLimit != null)
            this.L2GasLimit += action.L2GasLimit;
        this.instructions.splice(index, 0, ...action.instructions);
        if (this.feeRate == null)
            this.feeRate = action.feeRate;
        return this;
    }
    tx(feeRate, nonce) {
        return __awaiter(this, void 0, void 0, function* () {
            if (feeRate == null)
                feeRate = this.feeRate;
            if (feeRate == null)
                feeRate = yield this.estimateFeeRate();
            return {
                type: "INVOKE",
                tx: this.instructions,
                details: Object.assign(Object.assign({}, this.root.Fees.getFeeDetails(this.L1GasLimit, this.L2GasLimit, feeRate)), { walletAddress: this.mainSigner, cairoVersion: "1", chainId: this.root.chainId, nonce: (0, Utils_1.toHex)(nonce), accountDeploymentData: [], skipValidate: false })
            };
        });
    }
    addToTxs(txs, nonce, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            txs.push(yield this.tx(feeRate, nonce));
        });
    }
    ixsLength() {
        return this.instructions.length;
    }
}
exports.StarknetAction = StarknetAction;
