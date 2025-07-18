import { Call } from "starknet";
import { StarknetChainInterface } from "./StarknetChainInterface";
import { StarknetTx } from "./modules/StarknetTransactions";
export type StarknetGas = {
    l1?: number;
    l2?: number;
};
export declare function sumStarknetGas(a: StarknetGas, b: StarknetGas): {
    l1: number;
    l2: number;
};
export declare class StarknetAction {
    L1GasLimit: number;
    L2GasLimit: number;
    readonly mainSigner: string;
    private readonly root;
    private readonly instructions;
    private feeRate;
    constructor(mainSigner: string, root: StarknetChainInterface, instructions?: Call[] | Call, gasLimit?: StarknetGas, feeRate?: string);
    private estimateFeeRate;
    addIx(instruction: Call, gasLimit?: StarknetGas): void;
    add(action: StarknetAction): this;
    addAction(action: StarknetAction, index?: number): this;
    tx(feeRate?: string): Promise<StarknetTx>;
    addToTxs(txs: StarknetTx[], feeRate?: string): Promise<void>;
    ixsLength(): number;
}
