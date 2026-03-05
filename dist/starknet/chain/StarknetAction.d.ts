import { Call } from "starknet";
import { StarknetChainInterface } from "./StarknetChainInterface";
import { StarknetTx } from "./modules/StarknetTransactions";
import { StarknetGas } from "./modules/StarknetFees";
/**
 * An action which contains multiple underlying contract calls (invokes), tracks their total gas limits
 *  and allows creating a transaction, which will execute all the contract calls
 *
 * @category Chain Interface
 */
export declare class StarknetAction {
    /**
     * Total gas limit of all the contract calls
     */
    gas: StarknetGas;
    /**
     * Address of the signer for this transaction
     */
    readonly mainSigner: string;
    private readonly root;
    private readonly instructions;
    private feeRate?;
    constructor(mainSigner: string, root: StarknetChainInterface, instructions?: Call[] | Call, gasLimit?: StarknetGas, feeRate?: string);
    private estimateFeeRate;
    /**
     * Adds a single invoke call to the action along with the gas limits
     *
     * @param instruction Instruction to add to the action
     * @param gasLimit Gas limit required for the instruction
     */
    addIx(instruction: Call, gasLimit?: StarknetGas): void;
    /**
     * Adds contract calls from another starknet action to this action, while also adding its gas limits
     *
     * @param action Calls from this action are added to current action
     */
    add(action: StarknetAction): this;
    /**
     * Adds contract calls from another starknet action to this action, while also adding its gas limits. Adds
     *  the contract calls at a given index provided (by default at the end of existing calls)
     *
     * @param action Calls from this action are added to current action
     * @param index Index at which to add the calls (by defaults added at the end)
     */
    addAction(action: StarknetAction, index?: number): this;
    /**
     * Creates an unsigned starknet transaction out of this action, which executes all the underlying contract calls
     *
     * @param feeRate Fee rate to use for the transaction
     */
    tx(feeRate?: string): Promise<StarknetTx>;
    /**
     * Adds the generated transaction to an already existing array of transaction
     *
     * @param txs Transaction executing this action will be added to this transactions array
     * @param feeRate Fee rate to use for this transaction
     */
    addToTxs(txs: StarknetTx[], feeRate?: string): Promise<void>;
    /**
     * Number of individual contract calls in this action
     */
    ixsLength(): number;
}
