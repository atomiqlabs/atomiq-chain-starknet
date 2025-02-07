import {Account, Call, DeployAccountContractPayload, UniversalDetails} from "starknet";
import {StarknetBase} from "./StarknetBase";
import * as BN from "bn.js";
import {toBigInt, toHex} from "../../utils/Utils";
import {StarknetTx} from "./modules/StarknetTransactions";

export type StarknetGas = {l1?: number, l2?: number};

export function sumStarknetGas(a: StarknetGas, b: StarknetGas) {
    return {
        l1: (a?.l1 ?? 0) + (b?.l1 ?? 0),
        l2: (a?.l2 ?? 0) + (b?.l2 ?? 0)
    }
}

export class StarknetAction {

    L1GasLimit: number;
    L2GasLimit: number;
    readonly mainSigner: string;
    private readonly root: StarknetBase;
    private readonly instructions: Call[];
    private feeRate: string;

    constructor(
        mainSigner: string,
        root: StarknetBase,
        instructions: Call[] | Call = [],
        gasLimit?: StarknetGas,
        feeRate?: string
    ) {
        this.mainSigner = mainSigner;
        this.root = root;
        this.instructions = Array.isArray(instructions) ? instructions : [instructions];
        this.L1GasLimit = gasLimit?.l1 ?? 0;
        this.L2GasLimit = gasLimit?.l2 ?? 0;
        this.feeRate = feeRate;
    }

    private estimateFeeRate(): Promise<string> {
        return this.root.Fees.getFeeRate();
    }

    public addIx(instruction: Call, gasLimit?: StarknetGas) {
        this.instructions.push(instruction);
        this.L1GasLimit += gasLimit?.l1 ?? 0;
        this.L2GasLimit += gasLimit?.l2 ?? 0;
    }

    public add(action: StarknetAction): this {
        return this.addAction(action);
    }

    public addAction(action: StarknetAction, index: number = this.instructions.length): this {
        if(action.mainSigner!==this.mainSigner) throw new Error("Actions need to have the same signer!");
        if(this.L1GasLimit==null && action.L1GasLimit!=null) this.L1GasLimit = action.L1GasLimit;
        if(this.L2GasLimit==null && action.L2GasLimit!=null) this.L2GasLimit = action.L2GasLimit;
        if(this.L1GasLimit!=null && action.L1GasLimit!=null) this.L1GasLimit += action.L1GasLimit;
        if(this.L2GasLimit!=null && action.L2GasLimit!=null) this.L2GasLimit += action.L2GasLimit;
        this.instructions.splice(index, 0, ...action.instructions);
        if(this.feeRate==null) this.feeRate = action.feeRate;
        return this;
    }

    public async tx(feeRate?: string, nonce?: BN): Promise<StarknetTx> {
        if(feeRate==null) feeRate = this.feeRate;
        if(feeRate==null) feeRate = await this.estimateFeeRate();

        return {
            type: "INVOKE",
            tx: this.instructions,
            details: {
                ...this.root.Fees.getFeeDetails(this.L1GasLimit, this.L2GasLimit, feeRate),
                walletAddress: this.mainSigner,
                cairoVersion: "1",
                chainId: this.root.starknetChainId,
                nonce: toHex(nonce),
                accountDeploymentData: [],
                skipValidate: false
            }
        };
    }

    public async addToTxs(txs: StarknetTx[], feeRate?: string, nonce?: BN): Promise<void> {
        txs.push(await this.tx(feeRate, nonce));
    }

    public ixsLength(): number {
        return this.instructions.length;
    }

}
