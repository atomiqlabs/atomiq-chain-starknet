import { StarknetSwapData } from "../../StarknetSwapData";
import { BigNumberish } from "starknet";
import { ChainSwapType } from "@atomiqlabs/base";
import { StarknetGas } from "../../../chain/StarknetAction";
import { Buffer } from "buffer";
import { StarknetTx } from "../../../chain/modules/StarknetTransactions";
import { IClaimHandler } from "./ClaimHandlers";
export declare class HashlockClaimHandler implements IClaimHandler<Buffer, string> {
    readonly address: string;
    static readonly type: ChainSwapType;
    static readonly gas: StarknetGas;
    constructor(address: string);
    getCommitment(data: Buffer): BigNumberish;
    getWitness(signer: string, data: StarknetSwapData, witnessData: string): Promise<{
        initialTxns: StarknetTx[];
        witness: BigNumberish[];
    }>;
    getGas(): StarknetGas;
    getType(): ChainSwapType;
    parseWitnessResult(result: BigNumberish[]): string;
}
