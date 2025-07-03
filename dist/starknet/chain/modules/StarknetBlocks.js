"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetBlocks = void 0;
const StarknetModule_1 = require("../StarknetModule");
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
        const blockTimePromise = this.provider.getBlockWithTxHashes(blockTag).then(result => result.timestamp);
        const timestamp = Date.now();
        this.blockCache[blockTagStr] = {
            blockTime: blockTimePromise,
            timestamp
        };
        blockTimePromise.catch(e => {
            if (this.blockCache[blockTagStr] != null && this.blockCache[blockTagStr].blockTime === blockTimePromise)
                delete this.blockCache[blockTagStr];
            throw e;
        });
        return {
            blockTime: blockTimePromise,
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
    getBlockTime(blockTag) {
        this.cleanupBlocks();
        let cachedBlockData = this.blockCache[blockTag.toString(10)];
        if (cachedBlockData == null || Date.now() - cachedBlockData.timestamp > this.BLOCK_CACHE_TIME) {
            cachedBlockData = this.fetchAndSaveBlockTime(blockTag);
        }
        return cachedBlockData.blockTime;
    }
}
exports.StarknetBlocks = StarknetBlocks;
