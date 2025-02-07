/// <reference types="node" />
import { StarknetSwapData } from "../../../StarknetSwapData";
import { StarknetGas } from "../../../../base/StarknetAction";
import { ChainSwapType } from "@atomiqlabs/base";
import { BigNumberish } from "starknet";
import { StarknetTx } from "../../../../base/modules/StarknetTransactions";
import { BitcoinCommitmentData, IBitcoinClaimHandler } from "./IBitcoinClaimHandler";
import * as BN from "bn.js";
import { BitcoinOutputWitnessData } from "./BitcoinOutputClaimHandler";
export type BitcoinNoncedOutputCommitmentData = {
    output: Buffer;
    amount: BN;
    nonce: BN;
};
export declare class BitcoinNoncedOutputClaimHandler extends IBitcoinClaimHandler<BitcoinNoncedOutputCommitmentData, BitcoinOutputWitnessData> {
    static readonly address = "";
    static readonly type: ChainSwapType;
    static readonly gas: StarknetGas;
    protected serializeCommitment(data: BitcoinNoncedOutputCommitmentData & BitcoinCommitmentData): BigNumberish[];
    getWitness(signer: string, swapData: StarknetSwapData, witnessData: BitcoinOutputWitnessData, feeRate?: string): Promise<{
        initialTxns: StarknetTx[];
        witness: BigNumberish[];
    }>;
    getGas(data: StarknetSwapData): StarknetGas;
    getType(): ChainSwapType;
}
