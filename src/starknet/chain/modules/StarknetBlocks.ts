import {StarknetModule} from "../StarknetModule";

// https://github.com/starkware-libs/starknet-specs/blob/c2e93098b9c2ca0423b7f4d15b201f52f22d8c36/api/starknet_api_openrpc.json#L1234
export type StarknetBlockTag = "pre_confirmed" | "latest";

export class StarknetBlocks extends StarknetModule {

    private BLOCK_CACHE_TIME = 5*1000;

    private blockCache: {
        [key: string]: {
            blockTime: Promise<number>,
            timestamp: number
        }
    } = {};

    /**
     * Initiates fetch of a given block & saves it to cache
     *
     * @private
     * @param blockTag
     */
    private fetchAndSaveBlockTime(blockTag: StarknetBlockTag | number): {
        blockTime: Promise<number>,
        timestamp: number
    } {
        const blockTagStr = blockTag.toString(10);

        const blockTimePromise = this.provider.getBlockWithTxHashes(blockTag).then(result => result.timestamp);
        const timestamp = Date.now();
        this.blockCache[blockTagStr] = {
            blockTime: blockTimePromise,
            timestamp
        };
        blockTimePromise.catch(e => {
            if(this.blockCache[blockTagStr]!=null && this.blockCache[blockTagStr].blockTime===blockTimePromise) delete this.blockCache[blockTagStr];
            throw e;
        })
        return {
            blockTime: blockTimePromise,
            timestamp
        };
    }

    private cleanupBlocks() {
        const currentTime = Date.now();
        //Keys are in order that they were added, so we can stop at the first non-expired block
        for(let key in this.blockCache) {
            const block = this.blockCache[key];
            if(currentTime - block.timestamp > this.BLOCK_CACHE_TIME) {
                delete this.blockCache[key];
            } else {
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
    public getBlockTime(blockTag: StarknetBlockTag | number): Promise<number> {
        this.cleanupBlocks();
        let cachedBlockData = this.blockCache[blockTag.toString(10)];

        if(cachedBlockData==null || Date.now()-cachedBlockData.timestamp>this.BLOCK_CACHE_TIME) {
            cachedBlockData = this.fetchAndSaveBlockTime(blockTag);
        }

        return cachedBlockData.blockTime;
    }

}