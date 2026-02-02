import { BtcHeader } from "@atomiqlabs/base";
import { Buffer } from "buffer";
import { BigNumberish } from "starknet";
export type StarknetBtcHeaderType = {
    reversed_version: BigNumberish;
    previous_blockhash: BigNumberish[];
    merkle_root: BigNumberish[];
    reversed_timestamp: BigNumberish;
    nbits: BigNumberish;
    nonce: BigNumberish;
    hash?: Buffer;
};
/**
 * Representing a new bitcoin blockheader struct to be submitted to the Starknet BTC relay smart contract
 *
 * @category BTC Relay
 */
export declare class StarknetBtcHeader implements BtcHeader {
    reversed_version: number;
    previous_blockhash: number[];
    merkle_root: number[];
    reversed_timestamp: number;
    nbits: number;
    nonce: number;
    hash?: Buffer;
    /**
     * Constructs the bitcoin blockheader from a struct as returned by the starknet.js lib
     *
     * @param obj Struct as returned by the starknet.js lib
     */
    constructor(obj: StarknetBtcHeaderType);
    /**
     * @inheritDoc
     */
    getMerkleRoot(): Buffer;
    /**
     * @inheritDoc
     */
    getNbits(): number;
    /**
     * @inheritDoc
     */
    getNonce(): number;
    /**
     * @inheritDoc
     */
    getReversedPrevBlockhash(): Buffer;
    /**
     * @inheritDoc
     */
    getTimestamp(): number;
    /**
     * @inheritDoc
     */
    getVersion(): number;
    /**
     * @inheritDoc
     */
    getHash(): Buffer;
    /**
     * Serializes the bitcoin blockheader struct to an array of felt252 of length 20
     */
    serialize(): BigNumberish[];
    /**
     * Deserializes the store bitcoin blockheader from its felt252 array representation
     *
     * @param span felt252 array encoding the stored blockheader, has to be at least 20 felts long
     */
    static fromSerializedFeltArray(span: BigNumberish[]): StarknetBtcHeader;
}
