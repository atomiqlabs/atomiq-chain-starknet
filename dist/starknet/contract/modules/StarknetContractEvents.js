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
        this.abiEvents = starknet_1.events.getAbiEvents(this.abi);
        this.abiStructs = starknet_1.CallData.getAbiStruct(this.abi);
        this.abiEnums = starknet_1.CallData.getAbiEnum(this.abi);
        this.knownEventNames = Object.keys(this.abiEvents).map(hash => this.abiEvents[hash].name);
    }
    toStarknetAbiEvents(blockEvents) {
        return blockEvents.map((starknetEvent) => {
            // Convert StarknetEvent to EMITTED_EVENT format expected by parseEvents
            const [value] = starknet_1.events.parseEvents([{
                    ...starknetEvent,
                    transaction_index: starknetEvent.transaction_index ?? 0,
                    event_index: starknetEvent.event_index ?? 0
                }], this.abiEvents, this.abiStructs, this.abiEnums, (0, starknet_1.createAbiParser)(this.abi));
            if (value == null)
                throw new Error("Invalid event detected, please check provided ABI");
            const name = Object.keys(value).find(name => this.knownEventNames.includes(name));
            if (name == null)
                throw new Error("Invalid event detected (name), please check provided ABI");
            const event = {
                name: name,
                txHash: starknetEvent.transaction_hash,
                params: value[name],
                blockNumber: starknetEvent.block_number,
                blockHash: starknetEvent.block_hash,
                data: starknetEvent.data,
                keys: starknetEvent.keys
            };
            this.logger.debug("toStarknetAbiEvents(): Parsed event: ", event);
            return event;
        });
    }
    toFilter(events, keys) {
        const filterArray = [];
        filterArray.push(events.map(name => {
            const arr = name.split(":");
            const eventName = arr[arr.length - 1];
            return (0, Utils_1.toHex)(starknet_1.hash.starknetKeccak(eventName), 0);
        }));
        if (keys != null)
            keys.forEach(key => filterArray.push(key == null ? [] : Array.isArray(key) ? key.map(k => (0, Utils_1.toHex)(k, 0)) : [(0, Utils_1.toHex)(key, 0)]));
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
    async getContractBlockEvents(events, keys, startBlockHeight, endBlockHeight) {
        if (endBlockHeight === undefined)
            endBlockHeight = startBlockHeight;
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
            return null;
        }, abortSignal);
    }
    /**
     * Runs a search forwards in time, processing the events for a specific topic public key
     *
     * @param events
     * @param keys
     * @param processor called for every event, should return a value if the correct event was found, or null
     *  if the search should continue
     * @param startHeight
     * @param abortSignal
     */
    async findInContractEventsForward(events, keys, processor, startHeight, abortSignal) {
        return this.findInEventsForward(this.contract.contract.address, this.toFilter(events, keys), async (events) => {
            const parsedEvents = this.toStarknetAbiEvents(events);
            for (let event of parsedEvents) {
                const result = await processor(event);
                if (result != null)
                    return result;
            }
            return null;
        }, startHeight, abortSignal);
    }
}
exports.StarknetContractEvents = StarknetContractEvents;
