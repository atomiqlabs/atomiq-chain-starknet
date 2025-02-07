import {StarknetSwapData} from "../StarknetSwapData";
import {BigNumberish} from "starknet";
import {StarknetGas} from "../../base/StarknetAction";
import {StarknetTx} from "../../base/modules/StarknetTransactions";


export interface IHandler<TCommitmentData, TWitnessData> {

    getCommitment(data: TCommitmentData): BigNumberish;

    getWitness(signer: string, data: StarknetSwapData, witnessData: TWitnessData, feeRate?: string): Promise<{
        initialTxns: StarknetTx[],
        witness: BigNumberish[]
    }>;

    getGas(data: StarknetSwapData): StarknetGas;

}
