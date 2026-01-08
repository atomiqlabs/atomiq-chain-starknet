"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetBlocks = void 0;
const StarknetModule_1 = require("../StarknetModule");
const Utils_1 = require("../../../utils/Utils");
class StarknetBlocks extends StarknetModule_1.StarknetModule {
    constructor() {
        super(...arguments);
        this.BLOCK_CACHE_TIME = 5 * 1000;
        this.blockCache = {};
    }
    /**
     * Initiates fetch of a given block & saves it to cache
     *
     * @private
     * @param blockTag
     */
    fetchAndSaveBlockTime(blockTag) {
        const blockTagStr = blockTag.toString(10);
        const blockPromise = (0, Utils_1.tryWithRetries)(() => this.provider.getBlockWithTxHashes(blockTag), undefined, (err) => {
            if (err?.message != null) {
                const arr = err.message.split("\n");
                const errorCode = parseInt(arr[arr.length - 1]);
                //Block not found
                if (errorCode === 24)
                    return false;
            }
            return true;
        });
        const timestamp = Date.now();
        this.blockCache[blockTagStr] = {
            block: blockPromise,
            timestamp
        };
        blockPromise.catch(() => {
            if (this.blockCache[blockTagStr] != null && this.blockCache[blockTagStr].block === blockPromise)
                delete this.blockCache[blockTagStr];
        });
        return {
            block: blockPromise,
            timestamp
        };
    }
    cleanupBlocks() {
        const currentTime = Date.now();
        //Keys are in order that they were added, so we can stop at the first non-expired block
        for (let key in this.blockCache) {
            const block = this.blockCache[key];
            if (currentTime - block.timestamp > this.BLOCK_CACHE_TIME) {
                delete this.blockCache[key];
            }
            else {
                break;
            }
        }
    }
    ///////////////////
    //// Blocks
    /**
     * Gets the block for a given blocktag, with caching
     *
     * @param blockTag
     */
    getBlock(blockTag) {
        this.cleanupBlocks();
        let cachedBlockData = this.blockCache[blockTag.toString(10)];
        if (cachedBlockData == null || Date.now() - cachedBlockData.timestamp > this.BLOCK_CACHE_TIME) {
            cachedBlockData = this.fetchAndSaveBlockTime(blockTag);
        }
        return cachedBlockData.block;
    }
    /**
     * Gets the block for a given blocktag, with caching
     *
     * @param blockTag
     */
    async getBlockTime(blockTag) {
        const block = await this.getBlock(blockTag);
        return block.timestamp;
    }
}
exports.StarknetBlocks = StarknetBlocks;
