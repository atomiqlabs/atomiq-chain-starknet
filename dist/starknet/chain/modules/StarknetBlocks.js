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
        const blockTimePromise = this.provider.getBlockWithTxHashes(blockTag).then(result => result.timestamp);
        const timestamp = Date.now();
        this.blockCache[blockTag] = {
            blockTime: blockTimePromise,
            timestamp
        };
        blockTimePromise.catch(e => {
            if (this.blockCache[blockTag] != null && this.blockCache[blockTag].blockTime === blockTimePromise)
                delete this.blockCache[blockTag];
            throw e;
        });
        return {
            blockTime: blockTimePromise,
            timestamp
        };
    }
    ///////////////////
    //// Slots
    /**
     * Gets the block for a given blocktag, with caching
     *
     * @param blockTag
     */
    getBlockTime(blockTag) {
        let cachedBlockData = this.blockCache[blockTag];
        if (cachedBlockData == null || Date.now() - cachedBlockData.timestamp > this.BLOCK_CACHE_TIME) {
            cachedBlockData = this.fetchAndSaveBlockTime(blockTag);
        }
        return cachedBlockData.blockTime;
    }
}
exports.StarknetBlocks = StarknetBlocks;
