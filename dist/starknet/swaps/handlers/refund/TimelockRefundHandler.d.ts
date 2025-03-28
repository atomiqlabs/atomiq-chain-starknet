import { StarknetTx } from "../../../base/modules/StarknetTransactions";
import { StarknetSwapData } from "../../StarknetSwapData";
import { BigNumberish } from "starknet";
import { IHandler } from "../IHandler";
import { StarknetGas } from "../../../base/StarknetAction";
export declare class TimelockRefundHandler implements IHandler<bigint, never> {
    readonly address: string;
    static readonly gas: StarknetGas;
    constructor(address: string);
    getCommitment(data: bigint): BigNumberish;
    getWitness(signer: string, data: StarknetSwapData): Promise<{
        initialTxns: StarknetTx[];
        witness: BigNumberish[];
    }>;
    getGas(): StarknetGas;
    static getExpiry(data: StarknetSwapData): bigint;
}
