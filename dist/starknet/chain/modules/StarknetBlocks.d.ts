import { StarknetModule } from "../StarknetModule";
// https://github.com/starkware-libs/starknet-specs/blob/c2e93098b9c2ca0423b7f4d15b201f52f22d8c36/api/starknet_api_openrpc.json#L1234
export type StarknetBlockTag = BlockTag.PRE_CONFIRMED | BlockTag.LATEST;
export declare class StarknetBlocks extends StarknetModule {
    private BLOCK_CACHE_TIME;
    private blockCache;
    /**
     * Initiates fetch of a given block & saves it to cache
     *
     * @private
     * @param blockTag
     */
    private fetchAndSaveBlockTime;
    private cleanupBlocks;
    /**
     * Gets the block for a given blocktag, with caching
     *
     * @param blockTag
     */
    getBlockTime(blockTag: StarknetBlockTag | number): Promise<number>;
}
