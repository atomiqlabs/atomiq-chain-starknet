/// <reference types="node" />
import { StarknetSwapData } from "../../StarknetSwapData";
import { BigNumberish } from "starknet";
import { IHandler } from "../IHandler";
import { ChainSwapType } from "@atomiqlabs/base";
import { StarknetGas } from "../../../base/StarknetAction";
import { Buffer } from "buffer";
import { StarknetTx } from "../../../base/modules/StarknetTransactions";
export declare class HashlockClaimHandler implements IHandler<Buffer, string> {
    static readonly address = "";
    static readonly type: ChainSwapType;
    static readonly gas: StarknetGas;
    getCommitment(data: Buffer): BigNumberish;
    getWitness(signer: string, data: StarknetSwapData, witnessData: string): Promise<{
        initialTxns: StarknetTx[];
        witness: BigNumberish[];
    }>;
    getGas(): StarknetGas;
    getType(): ChainSwapType;
    parseWitnessResult(result: BigNumberish[]): string;
}
