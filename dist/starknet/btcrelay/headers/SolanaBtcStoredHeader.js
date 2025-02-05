"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetBtcStoredHeader = void 0;
const base_1 = require("@atomiqlabs/base");
const StarknetBtcHeader_1 = require("./StarknetBtcHeader");
const buffer_1 = require("buffer");
const Utils_1 = require("../../../utils/Utils");
class StarknetBtcStoredHeader {
    constructor(obj) {
        this.blockheader = obj.blockheader instanceof StarknetBtcHeader_1.StarknetBtcHeader ? obj.blockheader : new StarknetBtcHeader_1.StarknetBtcHeader(obj.blockheader);
        this.block_hash = obj.block_hash.map(val => Number(val));
        this.chain_work = obj.chain_work instanceof buffer_1.Buffer ? obj.chain_work : (0, Utils_1.bigNumberishToBuffer)(obj.chain_work, 32);
        this.block_height = Number(obj.block_height);
        this.last_diff_adjustment = Number(obj.last_diff_adjustment);
        this.prev_block_timestamps = obj.prev_block_timestamps.map(val => Number(val));
    }
    getBlockheight() {
        return this.block_height;
    }
    getChainWork() {
        return this.chain_work;
    }
    getHeader() {
        return this.blockheader;
    }
    getLastDiffAdjustment() {
        return this.last_diff_adjustment;
    }
    getPrevBlockTimestamps() {
        return this.prev_block_timestamps;
    }
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
        const chainWork = [...this.chain_work];
        base_1.StatePredictorUtils.addInPlace(chainWork, [...base_1.StatePredictorUtils.getDifficulty(nbits)]);
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
    computeNext(header) {
        return new StarknetBtcStoredHeader({
            chain_work: this.computeNextChainWork(header.nbits),
            prev_block_timestamps: this.computeNextBlockTimestamps(),
            block_height: this.block_height + 1,
            last_diff_adjustment: this.computeNextLastDiffAdjustment(header.getTimestamp()),
            block_hash: (0, Utils_1.bufferToU32Array)(header.getHash()),
            blockheader: header
        });
    }
}
exports.StarknetBtcStoredHeader = StarknetBtcStoredHeader;
