import {StarknetChainEventsBrowser} from "./StarknetChainEventsBrowser";
import * as fs from "fs/promises";
import {StarknetSwapContract} from "../swaps/StarknetSwapContract";

const BLOCKHEIGHT_FILENAME = "/strk-blockheight.txt";

export class StarknetChainEvents extends StarknetChainEventsBrowser {

    private readonly directory: string;

    constructor(
        directory: string,
        starknetSwapContract: StarknetSwapContract,
        pollIntervalSeconds?: number
    ) {
        super(starknetSwapContract, pollIntervalSeconds);
        this.directory = directory;
    }

    /**
     * Retrieves last signature & slot from filesystem
     *
     * @private
     */
    private async getLastBlockNumber(): Promise<number> {
        try {
            const txt = (await fs.readFile(this.directory+BLOCKHEIGHT_FILENAME)).toString();
            return parseInt(txt);
        } catch (e) {
            return null;
        }
    }

    /**
     * Saves last signature & slot to the filesystem
     *
     * @private
     */
    private saveLastBlockNumber(blockNumber: number): Promise<void> {
        return fs.writeFile(this.directory+BLOCKHEIGHT_FILENAME, blockNumber.toString());
    }

    async init(): Promise<void> {
        const lastProccessedBlockNumber = await this.getLastBlockNumber();
        this.setupPoll(lastProccessedBlockNumber, (blockNumber: number) => this.saveLastBlockNumber(blockNumber));
    }

}