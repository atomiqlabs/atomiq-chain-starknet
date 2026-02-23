import {BtcStoredHeader, StatePredictorUtils} from "@atomiqlabs/base";
import {StarknetBtcHeader, StarknetBtcHeaderType} from "./StarknetBtcHeader";
import {Buffer} from "buffer";
import {BigNumberish, cairo, Uint256} from "starknet";
import {bigNumberishToBuffer, bufferToU32Array, u32ArrayToBuffer, isUint256, toHex} from "../../../utils/Utils";

export type StarknetBtcStoredHeaderType = {
    blockheader: StarknetBtcHeader | StarknetBtcHeaderType,
    block_hash: BigNumberish[],
    chain_work: BigNumberish | Uint256,
    block_height: BigNumberish,
    last_diff_adjustment: BigNumberish,
    prev_block_timestamps: BigNumberish[]
}

/**
 * Representing a bitcoin blockheader struct which has already been saved and committed inside the
 *  Starknet BTC relay smart contract
 *
 * @category BTC Relay
 */
export class StarknetBtcStoredHeader implements BtcStoredHeader<StarknetBtcHeader> {

    private readonly blockheader: StarknetBtcHeader;
    private readonly block_hash: number[];
    private readonly chain_work: Uint256;
    private readonly block_height: number;
    private readonly last_diff_adjustment: number;
    private readonly prev_block_timestamps: number[];

    /**
     * Constructs the bitcoin stored blockheader from a struct as returned by the starknet.js lib
     *
     * @param obj Struct as returned by the starknet.js lib
     */
    constructor(obj: StarknetBtcStoredHeaderType) {
        this.blockheader = obj.blockheader instanceof StarknetBtcHeader ? obj.blockheader : new StarknetBtcHeader(obj.blockheader);
        this.block_hash = obj.block_hash.map(val => Number(val));
        this.chain_work = isUint256(obj.chain_work) ? obj.chain_work : cairo.uint256(obj.chain_work);
        this.block_height = Number(obj.block_height);
        this.last_diff_adjustment = Number(obj.last_diff_adjustment);
        this.prev_block_timestamps = obj.prev_block_timestamps.map(val => Number(val));
    }

    /**
     * @inheritDoc
     */
    getBlockheight(): number {
        return this.block_height;
    }

    /**
     * @inheritDoc
     */
    getChainWork(): Buffer {
        return bigNumberishToBuffer(this.chain_work, 32);
    }

    /**
     * @inheritDoc
     */
    getHeader(): StarknetBtcHeader {
        return this.blockheader;
    }

    /**
     * @inheritDoc
     */
    getLastDiffAdjustment(): number {
        return this.last_diff_adjustment;
    }

    /**
     * @inheritDoc
     */
    getPrevBlockTimestamps(): number[] {
        return this.prev_block_timestamps;
    }

    /**
     * @inheritDoc
     */
    getBlockHash(): Buffer {
        return u32ArrayToBuffer(this.block_hash).reverse();
    }

    /**
     * Computes prevBlockTimestamps for a next block, shifting the old block timestamps to the left & appending
     *  this block's timestamp to the end
     *
     * @private
     */
    private computeNextBlockTimestamps(): number[] {
        const prevBlockTimestamps = [...this.prev_block_timestamps];
        for(let i=1;i<10;i++) {
            prevBlockTimestamps[i-1] = prevBlockTimestamps[i];
        }
        prevBlockTimestamps[9] = this.blockheader.getTimestamp();
        return prevBlockTimestamps;
    }

    /**
     * Computes total chain work after a new header with "nbits" is added to the chain
     *
     * @param nbits
     * @private
     */
    private computeNextChainWork(nbits: number): Buffer {
        const chainWork = [...this.getChainWork()];
        StatePredictorUtils.addInPlace(chainWork, [...StatePredictorUtils.getChainwork(nbits)]);
        return Buffer.from(chainWork);
    }

    /**
     * Computes lastDiffAdjustment, this changes only once every DIFF_ADJUSTMENT_PERIOD blocks
     *
     * @param headerTimestamp
     * @private
     */
    private computeNextLastDiffAdjustment(headerTimestamp: number) {
        const blockheight = this.block_height+1;

        let lastDiffAdjustment = this.last_diff_adjustment;
        if(blockheight % StatePredictorUtils.DIFF_ADJUSTMENT_PERIOD === 0) {
            lastDiffAdjustment = headerTimestamp;
        }

        return lastDiffAdjustment;
    }

    /**
     * @inheritDoc
     */
    computeNext(header: StarknetBtcHeader): StarknetBtcStoredHeader {
        return new StarknetBtcStoredHeader({
            chain_work: "0x"+this.computeNextChainWork(header.getNbits()).toString("hex"),
            prev_block_timestamps: this.computeNextBlockTimestamps(),
            block_height: this.block_height+1,
            last_diff_adjustment: this.computeNextLastDiffAdjustment(header.getTimestamp()),
            block_hash: bufferToU32Array(header.getHash()),
            blockheader: header
        });
    }

    /**
     * Serializes the bitcoin stored blockheader struct to an array of felt252 of length 42
     */
    serialize(): BigNumberish[] {
        return [
            ...this.blockheader.serialize(),
            ...this.block_hash,
            this.chain_work.low,
            this.chain_work.high,
            this.block_height,
            this.last_diff_adjustment,
            ...this.prev_block_timestamps
        ]
    }

    /**
     * Deserializes the store bitcoin blockheader from its felt252 array representation
     *
     * @param span felt252 array encoding the stored blockheader, has to be at least 42 felts long
     */
    static fromSerializedFeltArray(span: BigNumberish[]): StarknetBtcStoredHeader {
        const blockheader = StarknetBtcHeader.fromSerializedFeltArray(span);
        if(span.length<22) throw new Error("Invalid serialized data size");
        const block_hash = span.splice(0, 8).map(val => toHex(val));
        const chain_work = {low: span.shift()!, high: span.shift()!};
        const block_height = toHex(span.shift()!);
        const last_diff_adjustment = toHex(span.shift()!);
        const prev_block_timestamps = span.splice(0, 10).map(val => toHex(val));
        return new StarknetBtcStoredHeader({
            blockheader,
            block_hash,
            chain_work,
            block_height,
            last_diff_adjustment,
            prev_block_timestamps
        });
    }

}