import { SpvWithdrawalTransactionData } from "@atomiqlabs/base";
import { Buffer } from "buffer";
import { BigNumberish } from "starknet";
/**
 * Represents parsed data for withdrawal (calling `claim()`) of the assets in the SPV vault (UTXO-controlled vault)
 *
 * @category Swaps
 */
export declare class StarknetSpvWithdrawalData extends SpvWithdrawalTransactionData {
    /**
     *
     * @param data
     * @protected
     */
    protected fromOpReturnData(data: Buffer): {
        recipient: string;
        rawAmounts: bigint[];
        executionHash?: string;
    };
    /**
     * @inheritDoc
     */
    isRecipient(address: string): boolean;
    /**
     * @inheritDoc
     */
    getTxHash(): bigint;
    /**
     * @inheritDoc
     */
    getFrontingAmount(): bigint[];
    /**
     * @inheritDoc
     */
    serialize(): any;
    /**
     * Serializes the withdrawal data to a starknet.js struct
     */
    serializeToStruct(): {
        recipient: string;
        amount: Record<number, boolean | object | BigNumberish>;
        caller_fee: Record<number, boolean | object | BigNumberish>;
        fronting_fee: Record<number, boolean | object | BigNumberish>;
        execution_handler_fee_amount_0: bigint;
        execution_hash: bigint;
        execution_expiry: bigint;
    };
    /**
     * Serializes the withdrawal data to a raw array of felt252 of length 10
     */
    serializeToFelts(): BigNumberish[];
    /**
     * @inheritDoc
     */
    getFrontingId(): string;
}
