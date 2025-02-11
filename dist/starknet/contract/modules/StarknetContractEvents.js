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
exports.StarknetContractEvents = void 0;
const StarknetEvents_1 = require("../../base/modules/StarknetEvents");
const starknet_1 = require("starknet");
const Utils_1 = require("../../../utils/Utils");
class StarknetContractEvents extends StarknetEvents_1.StarknetEvents {
    constructor(root, abi) {
        super(root);
        this.abi = abi;
    }
    toStarknetAbiEvents(blockEvents) {
        const abiEvents = starknet_1.events.getAbiEvents(this.abi);
        const abiStructs = starknet_1.CallData.getAbiStruct(this.abi);
        const abiEnums = starknet_1.CallData.getAbiEnum(this.abi);
        const result = starknet_1.events.parseEvents(blockEvents, abiEvents, abiStructs, abiEnums);
        if (result.length !== blockEvents.length)
            throw new Error("Invalid event detected, please check provided ABI");
        return result.map((value, index) => {
            const starknetEvent = blockEvents[index];
            const name = Object.keys(value)[0];
            return {
                name: name,
                txHash: starknetEvent.transaction_hash,
                params: value[name],
                blockNumber: starknetEvent.block_number,
                blockHash: starknetEvent.block_hash,
                data: starknetEvent.data,
                keys: starknetEvent.keys
            };
        });
    }
    toFilter(events, keys) {
        const filterArray = [];
        filterArray.push(events.map(name => {
            const arr = name.split(":");
            const eventName = arr[arr.length - 1];
            return (0, Utils_1.toHex)(starknet_1.hash.starknetKeccak(eventName));
        }));
        if (keys != null)
            keys.forEach(key => filterArray.push(key == null ? [] : [key]));
        return filterArray;
    }
    /**
     * Returns the events occuring in a range of starknet block as identified by the contract and keys,
     *  returns pending events if no startHeight & endHeight is passed
     *
     * @param events
     * @param keys
     * @param startBlockHeight
     * @param endBlockHeight
     */
    getContractBlockEvents(events, keys, startBlockHeight, endBlockHeight = startBlockHeight) {
        const _super = Object.create(null, {
            getBlockEvents: { get: () => super.getBlockEvents }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const blockEvents = yield _super.getBlockEvents.call(this, this.root.contract.address, this.toFilter(events, keys), startBlockHeight, endBlockHeight);
            return this.toStarknetAbiEvents(blockEvents);
        });
    }
    /**
     * Runs a search forawrds in time, processing the events for a specific topic public key
     *
     * @param events
     * @param keys
     * @param processor called for every event, should return a value if the correct event was found, or null
     *  if the search should continue
     * @param abortSignal
     */
    findInContractEvents(events, keys, processor, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.findInEvents(this.root.contract.address, this.toFilter(events, keys), (events) => __awaiter(this, void 0, void 0, function* () {
                const parsedEvents = this.toStarknetAbiEvents(events);
                for (let event of parsedEvents) {
                    const result = yield processor(event);
                    if (result != null)
                        return result;
                }
            }), abortSignal);
        });
    }
}
exports.StarknetContractEvents = StarknetContractEvents;
