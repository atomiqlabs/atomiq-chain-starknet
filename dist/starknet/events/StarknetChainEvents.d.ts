import { StarknetChainEventsBrowser } from "./StarknetChainEventsBrowser";
import { StarknetSwapContract } from "../swaps/StarknetSwapContract";
export declare class StarknetChainEvents extends StarknetChainEventsBrowser {
    private readonly directory;
    constructor(directory: string, starknetSwapContract: StarknetSwapContract, pollIntervalSeconds?: number);
    /**
     * Retrieves last signature & slot from filesystem
     *
     * @private
     */
    private getLastEventData;
    /**
     * Saves last signature & slot to the filesystem
     *
     * @private
     */
    private saveLastEventData;
    init(): Promise<void>;
}
