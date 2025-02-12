import {StarknetSwapData} from "../../../StarknetSwapData";
import {StarknetGas} from "../../../../base/StarknetAction";
import {ChainSwapType} from "@atomiqlabs/base";
import {BigNumberish, hash} from "starknet";
import {StarknetTx} from "../../../../base/modules/StarknetTransactions";
import {bufferToByteArray, getLogger, poseidonHashRange, toBigInt} from "../../../../../utils/Utils";
import {BitcoinCommitmentData, IBitcoinClaimHandler} from "./IBitcoinClaimHandler";
import * as BN from "bn.js";
import {Transaction} from "bitcoinjs-lib";
import {BitcoinOutputWitnessData} from "./BitcoinOutputClaimHandler";

export type BitcoinNoncedOutputCommitmentData = {
    output: Buffer,
    amount: BN,
    nonce: BN
};

const logger = getLogger("BitcoinNoncedOutputClaimHandler: ");

function getTransactionNonce(btcTx: Transaction): BN {
    const locktimeSub500M = new BN(btcTx.locktime - 500000000);
    if(locktimeSub500M.isNeg()) throw new Error("Locktime too low!");
    const nSequence = new BN(btcTx.ins[0].sequence);
    return locktimeSub500M.shln(24).or(nSequence.and(new BN(0x00FFFFFF)));
}

export class BitcoinNoncedOutputClaimHandler extends IBitcoinClaimHandler<BitcoinNoncedOutputCommitmentData, BitcoinOutputWitnessData> {

    public static readonly type: ChainSwapType = ChainSwapType.CHAIN_NONCED;
    public static readonly gas: StarknetGas = {l1: 20000};

    protected serializeCommitment(data: BitcoinNoncedOutputCommitmentData & BitcoinCommitmentData): BigNumberish[] {
        return [
            hash.computePoseidonHashOnElements([toBigInt(data.nonce), toBigInt(data.amount), poseidonHashRange(data.output)]),
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
            amount: new BN(out.value),
            nonce: getTransactionNonce(parsedBtcTx)
        });

        witness.push(...bufferToByteArray(Buffer.from(witnessData.tx.hex, "hex")));
        witness.push(BigInt(witnessData.vout));

        return {initialTxns, witness};
    }

    getGas(data: StarknetSwapData): StarknetGas {
        return BitcoinNoncedOutputClaimHandler.gas;
    }

    getType(): ChainSwapType {
        return BitcoinNoncedOutputClaimHandler.type;
    }

}
