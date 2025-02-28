"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetAction = exports.sumStarknetGas = void 0;
function sumStarknetGas(a, b) {
    return {
        l1: (a?.l1 ?? 0) + (b?.l1 ?? 0),
        l2: (a?.l2 ?? 0) + (b?.l2 ?? 0)
    };
}
exports.sumStarknetGas = sumStarknetGas;
class StarknetAction {
    constructor(mainSigner, root, instructions = [], gasLimit, feeRate) {
        this.mainSigner = mainSigner;
        this.root = root;
        this.instructions = Array.isArray(instructions) ? instructions : [instructions];
        this.L1GasLimit = gasLimit?.l1 ?? 0;
        this.L2GasLimit = gasLimit?.l2 ?? 0;
        this.feeRate = feeRate;
    }
    estimateFeeRate() {
        return this.root.Fees.getFeeRate();
    }
    addIx(instruction, gasLimit) {
        this.instructions.push(instruction);
        this.L1GasLimit += gasLimit?.l1 ?? 0;
        this.L2GasLimit += gasLimit?.l2 ?? 0;
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
    async tx(feeRate) {
        if (feeRate == null)
            feeRate = this.feeRate;
        if (feeRate == null)
            feeRate = await this.estimateFeeRate();
        return {
            type: "INVOKE",
            tx: this.instructions,
            details: {
                ...this.root.Fees.getFeeDetails(this.L1GasLimit, this.L2GasLimit, feeRate),
                walletAddress: this.mainSigner,
                cairoVersion: "1",
                chainId: this.root.starknetChainId,
                nonce: null,
                accountDeploymentData: [],
                skipValidate: false
            }
        };
    }
    async addToTxs(txs, feeRate) {
        txs.push(await this.tx(feeRate));
    }
    ixsLength() {
        return this.instructions.length;
    }
}
exports.StarknetAction = StarknetAction;
