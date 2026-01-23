"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetBtcStoredHeader = void 0;
const base_1 = require("@atomiqlabs/base");
const StarknetBtcHeader_1 = require("./StarknetBtcHeader");
const buffer_1 = require("buffer");
const starknet_1 = require("starknet");
const Utils_1 = require("../../../utils/Utils");
/**
 * Representing a bitcoin blockheader struct which has already been saved and committed inside the
 *  Starknet BTC relay smart contract
 *
 * @category BTC Relay
 */
class StarknetBtcStoredHeader {
    /**
     * Constructs the bitcoin stored blockheader from a struct as returned by the starknet.js lib
     *
     * @param obj Struct as returned by the starknet.js lib
     */
    constructor(obj) {
        this.blockheader = obj.blockheader instanceof StarknetBtcHeader_1.StarknetBtcHeader ? obj.blockheader : new StarknetBtcHeader_1.StarknetBtcHeader(obj.blockheader);
        this.block_hash = obj.block_hash.map(val => Number(val));
        this.chain_work = (0, Utils_1.isUint256)(obj.chain_work) ? obj.chain_work : starknet_1.cairo.uint256(obj.chain_work);
        this.block_height = Number(obj.block_height);
        this.last_diff_adjustment = Number(obj.last_diff_adjustment);
        this.prev_block_timestamps = obj.prev_block_timestamps.map(val => Number(val));
    }
    /**
     * @inheritDoc
     */
    getBlockheight() {
        return this.block_height;
    }
    /**
     * @inheritDoc
     */
    getChainWork() {
        return (0, Utils_1.bigNumberishToBuffer)(this.chain_work, 32);
    }
    /**
     * @inheritDoc
     */
    getHeader() {
        return this.blockheader;
    }
    /**
     * @inheritDoc
     */
    getLastDiffAdjustment() {
        return this.last_diff_adjustment;
    }
    /**
     * @inheritDoc
     */
    getPrevBlockTimestamps() {
        return this.prev_block_timestamps;
    }
    /**
     * @inheritDoc
     */
    getBlockHash() {
        return (0, Utils_1.u32ArrayToBuffer)(this.block_hash).reverse();
    }
    /**
     * Computes prevBlockTimestamps for a next block, shifting the old block timestamps to the left & appending
     *  this block's timestamp to the end
     *
     * @private
     */
    computeNextBlockTimestamps() {
        const prevBlockTimestamps = [...this.prev_block_timestamps];
        for (let i = 1; i < 10; i++) {
            prevBlockTimestamps[i - 1] = prevBlockTimestamps[i];
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
    computeNextChainWork(nbits) {
        const chainWork = [...this.getChainWork()];
        base_1.StatePredictorUtils.addInPlace(chainWork, [...base_1.StatePredictorUtils.getChainwork(nbits)]);
        return buffer_1.Buffer.from(chainWork);
    }
    /**
     * Computes lastDiffAdjustment, this changes only once every DIFF_ADJUSTMENT_PERIOD blocks
     *
     * @param headerTimestamp
     * @private
     */
    computeNextLastDiffAdjustment(headerTimestamp) {
        const blockheight = this.block_height + 1;
        let lastDiffAdjustment = this.last_diff_adjustment;
        if (blockheight % base_1.StatePredictorUtils.DIFF_ADJUSTMENT_PERIOD === 0) {
            lastDiffAdjustment = headerTimestamp;
        }
        return lastDiffAdjustment;
    }
    /**
     * @inheritDoc
     */
    computeNext(header) {
        return new StarknetBtcStoredHeader({
            chain_work: "0x" + this.computeNextChainWork(header.getNbits()).toString("hex"),
            prev_block_timestamps: this.computeNextBlockTimestamps(),
            block_height: this.block_height + 1,
            last_diff_adjustment: this.computeNextLastDiffAdjustment(header.getTimestamp()),
            block_hash: (0, Utils_1.bufferToU32Array)(header.getHash()),
            blockheader: header
        });
    }
    /**
     * Serializes the bitcoin stored blockheader struct to an array of felt252 of length 42
     */
    serialize() {
        return [
            ...this.blockheader.serialize(),
            ...this.block_hash,
            this.chain_work.low,
            this.chain_work.high,
            this.block_height,
            this.last_diff_adjustment,
            ...this.prev_block_timestamps
        ];
    }
    /**
     * Deserializes the store bitcoin blockheader from its felt252 array representation
     *
     * @param span felt252 array encoding the stored blockheader, has to be at least 42 felts long
     */
    static fromSerializedFeltArray(span) {
        const blockheader = StarknetBtcHeader_1.StarknetBtcHeader.fromSerializedFeltArray(span);
        if (span.length < 22)
            throw new Error("Invalid serialized data size");
        const block_hash = span.splice(0, 8).map(val => (0, Utils_1.toHex)(val));
        const chain_work = { low: span.shift(), high: span.shift() };
        const block_height = (0, Utils_1.toHex)(span.shift());
        const last_diff_adjustment = (0, Utils_1.toHex)(span.shift());
        const prev_block_timestamps = span.splice(0, 10).map(val => (0, Utils_1.toHex)(val));
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
exports.StarknetBtcStoredHeader = StarknetBtcStoredHeader;
