"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetAction = void 0;
const StarknetFees_1 = require("./modules/StarknetFees");
/**
 * An action which contains multiple underlying contract calls (invokes), tracks their total gas limits
 *  and allows creating a transaction, which will execute all the contract calls
 *
 * @category Chain Interface
 */
class StarknetAction {
    constructor(mainSigner, root, instructions = [], gasLimit, feeRate) {
        this.mainSigner = mainSigner;
        this.root = root;
        this.instructions = Array.isArray(instructions) ? instructions : [instructions];
        this.gas = {
            l1Gas: gasLimit?.l1Gas ?? 0,
            l2Gas: gasLimit?.l2Gas ?? 0,
            l1DataGas: gasLimit?.l1DataGas ?? 0,
        };
        this.feeRate = feeRate;
    }
    estimateFeeRate() {
        return this.root.Fees.getFeeRate();
    }
    /**
     * Adds a single invoke call to the action along with the gas limits
     *
     * @param instruction Instruction to add to the action
     * @param gasLimit Gas limit required for the instruction
     */
    addIx(instruction, gasLimit) {
        this.instructions.push(instruction);
        if (gasLimit != null)
            this.gas = StarknetFees_1.StarknetFees.starknetGasAdd(this.gas, gasLimit);
    }
    /**
     * Adds contract calls from another starknet action to this action, while also adding its gas limits
     *
     * @param action Calls from this action are added to current action
     */
    add(action) {
        return this.addAction(action);
    }
    /**
     * Adds contract calls from another starknet action to this action, while also adding its gas limits. Adds
     *  the contract calls at a given index provided (by default at the end of existing calls)
     *
     * @param action Calls from this action are added to current action
     * @param index Index at which to add the calls (by defaults added at the end)
     */
    addAction(action, index = this.instructions.length) {
        if (action.mainSigner !== this.mainSigner)
            throw new Error("Actions need to have the same signer!");
        if (this.gas.l1Gas == null && action.gas.l1Gas != null)
            this.gas.l1Gas = action.gas.l1Gas;
        if (this.gas.l2Gas == null && action.gas.l2Gas != null)
            this.gas.l2Gas = action.gas.l2Gas;
        if (this.gas.l1DataGas == null && action.gas.l1DataGas != null)
            this.gas.l1DataGas = action.gas.l1DataGas;
        if (this.gas.l1Gas != null && action.gas.l1Gas != null)
            this.gas.l1Gas += action.gas.l1Gas;
        if (this.gas.l2Gas != null && action.gas.l2Gas != null)
            this.gas.l2Gas += action.gas.l2Gas;
        if (this.gas.l1DataGas != null && action.gas.l1DataGas != null)
            this.gas.l1DataGas += action.gas.l1DataGas;
        this.instructions.splice(index, 0, ...action.instructions);
        if (this.feeRate == null)
            this.feeRate = action.feeRate;
        return this;
    }
    /**
     * Creates an unsigned starknet transaction out of this action, which executes all the underlying contract calls
     *
     * @param feeRate Fee rate to use for the transaction
     */
    async tx(feeRate) {
        if (feeRate == null)
            feeRate = this.feeRate;
        if (feeRate == null)
            feeRate = await this.estimateFeeRate();
        return {
            type: "INVOKE",
            tx: this.instructions,
            details: {
                ...this.root.Fees.getFeeDetails(this.gas, feeRate),
                walletAddress: this.mainSigner,
                cairoVersion: "1",
                chainId: this.root.starknetChainId,
                nonce: null,
                accountDeploymentData: [],
                skipValidate: false
            }
        };
    }
    /**
     * Adds the generated transaction to an already existing array of transaction
     *
     * @param txs Transaction executing this action will be added to this transactions array
     * @param feeRate Fee rate to use for this transaction
     */
    async addToTxs(txs, feeRate) {
        txs.push(await this.tx(feeRate));
    }
    /**
     * Number of individual contract calls in this action
     */
    ixsLength() {
        return this.instructions.length;
    }
}
exports.StarknetAction = StarknetAction;
