"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetChainEvents = void 0;
const StarknetChainEventsBrowser_1 = require("./StarknetChainEventsBrowser");
const fs = require("fs/promises");
const BLOCKHEIGHT_FILENAME = "/strk-blockheight.txt";
class StarknetChainEvents extends StarknetChainEventsBrowser_1.StarknetChainEventsBrowser {
    constructor(directory, starknetSwapContract, pollIntervalSeconds) {
        super(starknetSwapContract, pollIntervalSeconds);
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
                    txHash: null
                };
            return {
                blockNumber: parseInt(arr[0]),
                txHash: arr[1]
            };
        }
        catch (e) {
            return {
                blockNumber: null,
                txHash: null
            };
        }
    }
    /**
     * Saves last signature & slot to the filesystem
     *
     * @private
     */
    saveLastEventData(blockNumber, txHash) {
        return fs.writeFile(this.directory + BLOCKHEIGHT_FILENAME, blockNumber.toString() + ";" + txHash);
    }
    async init() {
        const { blockNumber, txHash } = await this.getLastEventData();
        await this.setupPoll(blockNumber, txHash, (blockNumber, txHash) => this.saveLastEventData(blockNumber, txHash));
    }
}
exports.StarknetChainEvents = StarknetChainEvents;
