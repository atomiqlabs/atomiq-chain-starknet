"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetChainEvents = void 0;
const StarknetChainEventsBrowser_1 = require("./StarknetChainEventsBrowser");
//@ts-ignore
const fs = require("fs/promises");
const BLOCKHEIGHT_FILENAME = "/strk-blockheight.txt";
class StarknetChainEvents extends StarknetChainEventsBrowser_1.StarknetChainEventsBrowser {
    constructor(directory, chainInterface, starknetSwapContract, starknetSpvVaultContract, pollIntervalSeconds) {
        super(chainInterface, starknetSwapContract, starknetSpvVaultContract, pollIntervalSeconds);
        this.directory = directory;
    }
    /**
     * Retrieves last signature & slot from filesystem
     *
     * @private
     */
    async getLastEventData() {
        try {
            const txt = (await fs.readFile(this.directory + BLOCKHEIGHT_FILENAME)).toString();
            const arr = txt.split(";");
            if (arr.length < 2)
                return {
                    blockNumber: parseInt(arr[0]),
                    txHashes: null
                };
            return {
                blockNumber: parseInt(arr[0]),
                txHashes: arr.slice(1)
            };
        }
        catch (e) {
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
    saveLastEventData(blockNumber, txHashes) {
        return fs.writeFile(this.directory + BLOCKHEIGHT_FILENAME, blockNumber.toString() + ";" + txHashes.join(";"));
    }
    async init() {
        const { blockNumber, txHashes } = await this.getLastEventData();
        await this.setupPoll(blockNumber, txHashes, (blockNumber, txHashes) => this.saveLastEventData(blockNumber, txHashes));
    }
}
exports.StarknetChainEvents = StarknetChainEvents;
