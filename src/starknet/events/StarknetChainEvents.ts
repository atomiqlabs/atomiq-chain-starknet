import {StarknetChainEventsBrowser} from "./StarknetChainEventsBrowser";
//@ts-ignore
import * as fs from "fs/promises";
import {StarknetSwapContract} from "../swaps/StarknetSwapContract";
import {StarknetChainInterface} from "../chain/StarknetChainInterface";
import {StarknetSpvVaultContract} from "../spv_swap/StarknetSpvVaultContract";

const BLOCKHEIGHT_FILENAME = "/strk-blockheight.txt";

export class StarknetChainEvents extends StarknetChainEventsBrowser {

    private readonly directory: string;

    constructor(
        directory: string,
        chainInterface: StarknetChainInterface,
        starknetSwapContract: StarknetSwapContract,
        starknetSpvVaultContract: StarknetSpvVaultContract,
        pollIntervalSeconds?: number
    ) {
        super(chainInterface, starknetSwapContract, starknetSpvVaultContract, pollIntervalSeconds);
        this.directory = directory;
    }

    /**
     * Retrieves last signature & slot from filesystem
     *
     * @private
     */
    private async getLastEventData(): Promise<{blockNumber: number, txHashes: string[]}> {
        try {
            const txt: string = (await fs.readFile(this.directory+BLOCKHEIGHT_FILENAME)).toString();
            const arr = txt.split(";");
            if(arr.length<2) return {
                blockNumber: parseInt(arr[0]),
                txHashes: null
            };
            return {
                blockNumber: parseInt(arr[0]),
                txHashes: arr.slice(1)
            };
        } catch (e) {
            return {
                blockNumber: null,
                txHashes: null
            };
        }
    }

    /**
     * Saves last signature & slot to the filesystem
     *
     * @private
     */
    private saveLastEventData(blockNumber: number, txHashes: string[]): Promise<void> {
        return fs.writeFile(this.directory+BLOCKHEIGHT_FILENAME, blockNumber.toString()+";"+txHashes.join(";"));
    }

    async init(): Promise<void> {
        const {blockNumber, txHashes} = await this.getLastEventData();
        await this.setupPoll(
            blockNumber,
            txHashes,
            (blockNumber: number, txHashes: string[]) => this.saveLastEventData(blockNumber, txHashes)
        );
    }

}