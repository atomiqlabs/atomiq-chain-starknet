import { StarknetTx } from "../../../base/modules/StarknetTransactions";
import { StarknetSwapData } from "../../StarknetSwapData";
import { BigNumberish } from "starknet";
import { IHandler } from "../IHandler";
import { StarknetGas } from "../../../base/StarknetAction";
import * as BN from "bn.js";
export declare class TimelockRefundHandler implements IHandler<BN, never> {
    static readonly address = "";
    static readonly gas: StarknetGas;
    getCommitment(data: BN): BigNumberish;
    getWitness(signer: string, data: StarknetSwapData): Promise<{
        initialTxns: StarknetTx[];
        witness: BigNumberish[];
    }>;
    getGas(): StarknetGas;
    static getExpiry(data: StarknetSwapData): bigint;
}
