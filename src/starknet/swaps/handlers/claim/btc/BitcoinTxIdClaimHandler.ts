import {StarknetSwapData} from "../../../StarknetSwapData";
import {StarknetGas} from "../../../../base/StarknetAction";
import {ChainSwapType} from "@atomiqlabs/base";
import {BigNumberish} from "starknet";
import {StarknetTx} from "../../../../base/modules/StarknetTransactions";
import {bufferToU32Array, getLogger} from "../../../../../utils/Utils";
import {BitcoinCommitmentData, BitcoinWitnessData, IBitcoinClaimHandler} from "./IBitcoinClaimHandler";

export type BitcoinTxIdCommitmentData = {
    txId: string
};

const logger = getLogger("BitcoinTxIdClaimHandler: ");

export class BitcoinTxIdClaimHandler extends IBitcoinClaimHandler<BitcoinTxIdCommitmentData, BitcoinWitnessData> {

    public static readonly address = "";
    public static readonly type: ChainSwapType = ChainSwapType.CHAIN_TXID;
    public static readonly gas: StarknetGas = {l1: 20000};

    protected serializeCommitment(data: BitcoinTxIdCommitmentData & BitcoinCommitmentData): BigNumberish[] {
        return [
            ...bufferToU32Array(Buffer.from(data.txId, "hex").reverse()),
            ...super.serializeCommitment(data)
        ];
    }

    getWitness(
        signer: string,
        swapData: StarknetSwapData,
        witnessData: BitcoinWitnessData,
        feeRate?: string
    ): Promise<{
        initialTxns: StarknetTx[];
        witness: BigNumberish[]
    }> {
        if(!swapData.isClaimHandler(BitcoinTxIdClaimHandler.address)) throw new Error("Invalid claim handler");

        return this._getWitness(signer, swapData, witnessData, {txId: witnessData.tx.txid});
    }

    getGas(data: StarknetSwapData): StarknetGas {
        return BitcoinTxIdClaimHandler.gas;
    }

    getType(): ChainSwapType {
        return BitcoinTxIdClaimHandler.type;
    }

}
