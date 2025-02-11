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
    private async getLastEventData(): Promise<{blockNumber: number, txHash: string}> {
        try {
            const txt = (await fs.readFile(this.directory+BLOCKHEIGHT_FILENAME)).toString();
            const arr = txt.split(";");
            if(arr.length<2) return {
                blockNumber: parseInt(arr[0]),
                txHash: null
            };
            return {
                blockNumber: parseInt(arr[0]),
                txHash: arr[1]
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * Saves last signature & slot to the filesystem
     *
     * @private
     */
    private saveLastEventData(blockNumber: number, txHash: string): Promise<void> {
        return fs.writeFile(this.directory+BLOCKHEIGHT_FILENAME, blockNumber.toString()+";"+txHash);
    }

    async init(): Promise<void> {
        const {blockNumber, txHash} = await this.getLastEventData();
        await this.setupPoll(
            blockNumber,
            txHash,
            (blockNumber: number, txHash: string) => this.saveLastEventData(blockNumber, txHash)
        );
    }

}