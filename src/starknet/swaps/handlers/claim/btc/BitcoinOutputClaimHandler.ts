import {StarknetSwapData} from "../../../StarknetSwapData";
import {StarknetGas} from "../../../../base/StarknetAction";
import {ChainSwapType} from "@atomiqlabs/base";
import {BigNumberish, hash} from "starknet";
import {StarknetTx} from "../../../../base/modules/StarknetTransactions";
import {bufferToByteArray, getLogger, poseidonHashRange, toBigInt} from "../../../../../utils/Utils";
import {BitcoinCommitmentData, BitcoinWitnessData, IBitcoinClaimHandler} from "./IBitcoinClaimHandler";
import * as BN from "bn.js";
import {Transaction} from "bitcoinjs-lib";

export type BitcoinOutputCommitmentData = {
    output: Buffer,
    amount: BN
};

export type BitcoinOutputWitnessData = BitcoinWitnessData & {
    vout: number
};

const logger = getLogger("BitcoinOutputClaimHandler: ");

export class BitcoinOutputClaimHandler extends IBitcoinClaimHandler<BitcoinOutputCommitmentData, BitcoinOutputWitnessData> {

    public static readonly type: ChainSwapType = ChainSwapType.CHAIN;
    public static readonly gas: StarknetGas = {l1: 20000};

    protected serializeCommitment(data: BitcoinOutputCommitmentData & BitcoinCommitmentData): BigNumberish[] {
        return [
            hash.computePoseidonHashOnElements([toBigInt(data.amount), poseidonHashRange(data.output)]),
            ...super.serializeCommitment(data)
        ];
    }

    async getWitness(
        signer: string,
        swapData: StarknetSwapData,
        witnessData: BitcoinOutputWitnessData,
        feeRate?: string
    ): Promise<{
        initialTxns: StarknetTx[];
        witness: BigNumberish[]
    }> {
        if(!swapData.isClaimHandler(this.address)) throw new Error("Invalid claim handler");

        const parsedBtcTx = Transaction.fromHex(witnessData.tx.hex);
        const out = parsedBtcTx.outs[witnessData.vout];

        const {initialTxns, witness} = await this._getWitness(signer, swapData, witnessData, {
            output: out.script,
            amount: new BN(out.value)
        });

        witness.push(...bufferToByteArray(Buffer.from(witnessData.tx.hex, "hex")));
        witness.push(BigInt(witnessData.vout));

        return {initialTxns, witness};
    }

    getGas(data: StarknetSwapData): StarknetGas {
        return BitcoinOutputClaimHandler.gas;
    }

    getType(): ChainSwapType {
        return BitcoinOutputClaimHandler.type;
    }

}
