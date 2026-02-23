import { BtcStoredHeader } from "@atomiqlabs/base";
import { StarknetBtcHeader, StarknetBtcHeaderType } from "./StarknetBtcHeader";
import { Buffer } from "buffer";
import { BigNumberish, Uint256 } from "starknet";
export type StarknetBtcStoredHeaderType = {
    blockheader: StarknetBtcHeader | StarknetBtcHeaderType;
    block_hash: BigNumberish[];
    chain_work: BigNumberish | Uint256;
    block_height: BigNumberish;
    last_diff_adjustment: BigNumberish;
    prev_block_timestamps: BigNumberish[];
};
/**
 * Representing a bitcoin blockheader struct which has already been saved and committed inside the
 *  Starknet BTC relay smart contract
 *
 * @category BTC Relay
 */
export declare class StarknetBtcStoredHeader implements BtcStoredHeader<StarknetBtcHeader> {
    private readonly blockheader;
    private readonly block_hash;
    private readonly chain_work;
    private readonly block_height;
    private readonly last_diff_adjustment;
    private readonly prev_block_timestamps;
    /**
     * Constructs the bitcoin stored blockheader from a struct as returned by the starknet.js lib
     *
     * @param obj Struct as returned by the starknet.js lib
     */
    constructor(obj: StarknetBtcStoredHeaderType);
    /**
     * @inheritDoc
     */
    getBlockheight(): number;
    /**
     * @inheritDoc
     */
    getChainWork(): Buffer;
    /**
     * @inheritDoc
     */
    getHeader(): StarknetBtcHeader;
    /**
     * @inheritDoc
     */
    getLastDiffAdjustment(): number;
    /**
     * @inheritDoc
     */
    getPrevBlockTimestamps(): number[];
    /**
     * @inheritDoc
     */
    getBlockHash(): Buffer;
    /**
     * Computes prevBlockTimestamps for a next block, shifting the old block timestamps to the left & appending
     *  this block's timestamp to the end
     *
     * @private
     */
    private computeNextBlockTimestamps;
    /**
     * Computes total chain work after a new header with "nbits" is added to the chain
     *
     * @param nbits
     * @private
     */
    private computeNextChainWork;
    /**
     * Computes lastDiffAdjustment, this changes only once every DIFF_ADJUSTMENT_PERIOD blocks
     *
     * @param headerTimestamp
     * @private
     */
    private computeNextLastDiffAdjustment;
    /**
     * @inheritDoc
     */
    computeNext(header: StarknetBtcHeader): StarknetBtcStoredHeader;
    /**
     * Serializes the bitcoin stored blockheader struct to an array of felt252 of length 42
     */
    serialize(): BigNumberish[];
    /**
     * Deserializes the store bitcoin blockheader from its felt252 array representation
     *
     * @param span felt252 array encoding the stored blockheader, has to be at least 42 felts long
     */
    static fromSerializedFeltArray(span: BigNumberish[]): StarknetBtcStoredHeader;
}
