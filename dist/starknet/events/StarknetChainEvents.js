"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    getLastEventData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const txt = (yield fs.readFile(this.directory + BLOCKHEIGHT_FILENAME)).toString();
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
                return null;
            }
        });
    }
    /**
     * Saves last signature & slot to the filesystem
     *
     * @private
     */
    saveLastEventData(blockNumber, txHash) {
        return fs.writeFile(this.directory + BLOCKHEIGHT_FILENAME, blockNumber.toString() + ";" + txHash);
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            const { blockNumber, txHash } = yield this.getLastEventData();
            yield this.setupPoll(blockNumber, txHash, (blockNumber, txHash) => this.saveLastEventData(blockNumber, txHash));
        });
    }
}
exports.StarknetChainEvents = StarknetChainEvents;
