/// <reference types="node" />
import { StarknetSwapData } from "../../../StarknetSwapData";
import { StarknetGas } from "../../../../base/StarknetAction";
import { ChainSwapType } from "@atomiqlabs/base";
import { BigNumberish } from "starknet";
import { StarknetTx } from "../../../../base/modules/StarknetTransactions";
import { BitcoinCommitmentData, BitcoinWitnessData, IBitcoinClaimHandler } from "./IBitcoinClaimHandler";
import * as BN from "bn.js";
export type BitcoinOutputCommitmentData = {
    output: Buffer;
    amount: BN;
};
export type BitcoinOutputWitnessData = BitcoinWitnessData & {
    vout: number;
};
export declare class BitcoinOutputClaimHandler extends IBitcoinClaimHandler<BitcoinOutputCommitmentData, BitcoinOutputWitnessData> {
    static readonly address = "";
    static readonly type: ChainSwapType;
    static readonly gas: StarknetGas;
    protected serializeCommitment(data: BitcoinOutputCommitmentData & BitcoinCommitmentData): BigNumberish[];
    getWitness(signer: string, swapData: StarknetSwapData, witnessData: BitcoinOutputWitnessData, feeRate?: string): Promise<{
        initialTxns: StarknetTx[];
        witness: BigNumberish[];
    }>;
    getGas(data: StarknetSwapData): StarknetGas;
    getType(): ChainSwapType;
}
