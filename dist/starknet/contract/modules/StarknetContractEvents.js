"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetContractEvents = void 0;
const StarknetEvents_1 = require("../../chain/modules/StarknetEvents");
const starknet_1 = require("starknet");
const Utils_1 = require("../../../utils/Utils");
class StarknetContractEvents extends StarknetEvents_1.StarknetEvents {
    constructor(chainInterface, contract, abi) {
        super(chainInterface);
        this.contract = contract;
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
    async getContractBlockEvents(events, keys, startBlockHeight, endBlockHeight = startBlockHeight) {
        const blockEvents = await super.getBlockEvents(this.contract.contract.address, this.toFilter(events, keys), startBlockHeight, endBlockHeight);
        return this.toStarknetAbiEvents(blockEvents);
    }
    /**
     * Runs a search backwards in time, processing the events for a specific topic public key
     *
     * @param events
     * @param keys
     * @param processor called for every event, should return a value if the correct event was found, or null
     *  if the search should continue
     * @param abortSignal
     */
    async findInContractEvents(events, keys, processor, abortSignal) {
        return this.findInEvents(this.contract.contract.address, this.toFilter(events, keys), async (events) => {
            const parsedEvents = this.toStarknetAbiEvents(events);
            for (let event of parsedEvents) {
                const result = await processor(event);
                if (result != null)
                    return result;
            }
        }, abortSignal);
    }
    /**
     * Runs a search forwards in time, processing the events for a specific topic public key
     *
     * @param events
     * @param keys
     * @param processor called for every event, should return a value if the correct event was found, or null
     *  if the search should continue
     * @param abortSignal
     */
    async findInContractEventsForward(events, keys, processor, abortSignal) {
        return this.findInEventsForward(this.contract.contract.address, this.toFilter(events, keys), async (events) => {
            const parsedEvents = this.toStarknetAbiEvents(events);
            for (let event of parsedEvents) {
                const result = await processor(event);
                if (result != null)
                    return result;
            }
        }, abortSignal);
    }
}
exports.StarknetContractEvents = StarknetContractEvents;
