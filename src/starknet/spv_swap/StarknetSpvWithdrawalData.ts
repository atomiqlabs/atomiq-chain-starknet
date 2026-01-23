import {BigIntBufferUtils, SpvWithdrawalTransactionData} from "@atomiqlabs/base";
import {Buffer} from "buffer";
import {BigNumberish, cairo, hash} from "starknet";
import {toBigInt} from "../../utils/Utils";
import {StarknetSpvVaultContract} from "./StarknetSpvVaultContract";


/**
 * Represents parsed data for withdrawal (calling `claim()`) of the assets in the SPV vault (UTXO-controlled vault)
 *
 * @category Swaps
 */
export class StarknetSpvWithdrawalData extends SpvWithdrawalTransactionData {

    /**
     *
     * @param data
     * @protected
     */
    protected fromOpReturnData(data: Buffer): { recipient: string; rawAmounts: bigint[]; executionHash?: string } {
        return StarknetSpvVaultContract.fromOpReturnData(data);
    }

    /**
     * @inheritDoc
     */
    isRecipient(address: string): boolean {
        return this.getRecipient().toLowerCase()===address.toLowerCase();
    }

    /**
     * @inheritDoc
     */
    getTxHash(): bigint {
        return BigInt("0x"+Buffer.from(this.btcTx.txid, "hex").reverse().toString("hex"));
    }

    /**
     * @inheritDoc
     */
    getFrontingAmount(): bigint[] {
        return [this.rawAmounts[0] + this.getExecutionFee()[0], this.rawAmounts[1]];
    }

    /**
     * @inheritDoc
     */
    serialize(): any {
        return {
            type: "STARKNET",
            ...super.serialize()
        };
    }

    /**
     * Serializes the withdrawal data to a starknet.js struct
     */
    serializeToStruct() {
        const callerFee = this.getCallerFee();
        const frontingFee = this.getFrontingFee();
        const executionFee = this.getExecutionFee();
        return {
            recipient: this.recipient,
            amount: cairo.tuple(this.rawAmounts[0], this.rawAmounts[1]),
            caller_fee: cairo.tuple(callerFee[0], callerFee[1]),
            fronting_fee: cairo.tuple(frontingFee[0], frontingFee[1]),
            execution_handler_fee_amount_0: executionFee[0],
            execution_hash: toBigInt(this.executionHash) ?? 0n,
            execution_expiry: BigInt(this.executionExpiry)
        }
    }

    /**
     * Serializes the withdrawal data to a raw array of felt252 of length 10
     */
    serializeToFelts(): BigNumberish[] {
        const callerFee = this.getCallerFee();
        const frontingFee = this.getFrontingFee();
        const executionFee = this.getExecutionFee();
        return [
            this.recipient,
            this.rawAmounts[0],
            this.rawAmounts[1],
            callerFee[0],
            callerFee[1],
            frontingFee[0],
            frontingFee[1],
            executionFee[0],
            toBigInt(this.executionHash) ?? 0n,
            BigInt(this.executionExpiry)
        ]
    }

    /**
     * @inheritDoc
     */
    getFrontingId(): string {
        const txHashU256 = cairo.uint256(BigIntBufferUtils.fromBuffer(Buffer.from(this.btcTx.txid, "hex"), "le"));
        let frontingId = hash.computePoseidonHashOnElements([
            txHashU256.low,
            txHashU256.high,
            ...this.serializeToFelts()
        ]);
        if(frontingId.startsWith("0x")) frontingId = frontingId.slice(2);
        return frontingId.padStart(64, "0");
    }

}

SpvWithdrawalTransactionData.deserializers["STARKNET"] = StarknetSpvWithdrawalData;
