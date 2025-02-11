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
exports.StarknetEvents = void 0;
const StarknetModule_1 = require("../StarknetModule");
class StarknetEvents extends StarknetModule_1.StarknetModule {
    constructor() {
        super(...arguments);
        this.EVENTS_LIMIT = 100;
        this.FORWARD_BLOCK_RANGE = 2000;
    }
    /**
     * Returns the all the events occuring in a block range as identified by the contract and keys
     *
     * @param contract
     * @param keys
     * @param startBlock
     * @param endBlock
     * @param abortSignal
     */
    getBlockEvents(contract, keys, startBlock, endBlock = startBlock, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const events = [];
            let result = null;
            while (result == null || (result === null || result === void 0 ? void 0 : result.continuation_token) != null) {
                result = yield this.root.provider.getEvents({
                    address: contract,
                    from_block: startBlock == null ? "pending" : { block_number: startBlock },
                    to_block: endBlock == null ? "pending" : { block_number: endBlock },
                    keys,
                    chunk_size: this.EVENTS_LIMIT,
                    continuation_token: result === null || result === void 0 ? void 0 : result.continuation_token
                });
                if (abortSignal != null)
                    abortSignal.throwIfAborted();
                events.push(...result.events);
            }
            return events;
        });
    }
    /**
     * Runs a search backwards in time, processing events from a specific contract and keys
     *
     * @param contract
     * @param keys
     * @param processor called for every batch of returned signatures, should return a value if the correct signature
     *  was found, or null if the search should continue
     * @param abortSignal
     */
    findInEvents(contract, keys, processor, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const latestBlockNumber = yield this.provider.getBlockNumber();
            for (let blockNumber = latestBlockNumber; blockNumber >= 0; blockNumber -= this.FORWARD_BLOCK_RANGE) {
                const eventsResult = yield this.getBlockEvents(contract, keys, Math.max(blockNumber - this.FORWARD_BLOCK_RANGE, 0), blockNumber, abortSignal);
                const result = yield processor(eventsResult.reverse());
                if (result != null)
                    return result;
            }
            return null;
        });
    }
    /**
     * Runs a search forwards in time, processing events from a specific contract and keys
     *
     * @param contract
     * @param keys
     * @param processor called for every batch of returned signatures, should return a value if the correct signature
     *  was found, or null if the search should continue
     * @param abortSignal
     * @param logFetchLimit
     */
    findInEventsForward(contract, keys, processor, abortSignal, logFetchLimit) {
        return __awaiter(this, void 0, void 0, function* () {
            if (logFetchLimit == null || logFetchLimit > this.EVENTS_LIMIT)
                logFetchLimit = this.EVENTS_LIMIT;
            let eventsResult = null;
            while (eventsResult == null || (eventsResult === null || eventsResult === void 0 ? void 0 : eventsResult.continuation_token) != null) {
                eventsResult = yield this.root.provider.getEvents({
                    address: contract,
                    to_block: "latest",
                    keys,
                    chunk_size: logFetchLimit !== null && logFetchLimit !== void 0 ? logFetchLimit : this.EVENTS_LIMIT,
                    continuation_token: eventsResult === null || eventsResult === void 0 ? void 0 : eventsResult.continuation_token
                });
                if (abortSignal != null)
                    abortSignal.throwIfAborted();
                const result = yield processor(eventsResult.events);
                if (result != null)
                    return result;
            }
            return null;
        });
    }
}
exports.StarknetEvents = StarknetEvents;
