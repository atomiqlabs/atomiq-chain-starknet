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
const ERC20Abi_1 = require("../../base/modules/ERC20Abi");
const Utils_1 = require("../../../utils/Utils");
class StarknetContractEvents extends StarknetEvents_1.StarknetEvents {
    constructor(root) {
        super(root);
    }
    getAbiEvent(abiEvents, keys) {
        var _a;
        let abiEvent = abiEvents[(_a = keys[0]) !== null && _a !== void 0 ? _a : 0];
        if (!abiEvent) {
            return null;
        }
        let i = 1;
        while (!abiEvent.name) {
            const hashName = keys[i];
            if (hashName == null)
                throw new Error('Not enough data in "key" property of this event.');
            abiEvent = abiEvent[hashName];
            i++;
        }
    }
    toStarknetAbiEvents(blockEvents) {
        const abiEvents = starknet_1.events.getAbiEvents(ERC20Abi_1.ERC20Abi);
        const abiStructs = starknet_1.CallData.getAbiStruct(ERC20Abi_1.ERC20Abi);
        const abiEnums = starknet_1.CallData.getAbiEnum(ERC20Abi_1.ERC20Abi);
        const decodedAbiEvents = blockEvents.map(val => this.getAbiEvent(abiEvents, val.keys));
        const result = starknet_1.events.parseEvents(blockEvents, abiEvents, abiStructs, abiEnums);
        if (result.length !== blockEvents.length)
            throw new Error("Invalid event detected, please check provided ABI");
        return result.map((value, index) => {
            const decodedAbiEvent = decodedAbiEvents[index];
            const starknetEvent = blockEvents[index];
            return {
                name: decodedAbiEvent.name,
                txHash: starknetEvent.transaction_hash,
                params: value,
                blockNumber: starknetEvent.block_number,
                blockHash: starknetEvent.block_hash
            };
        });
    }
    toFilter(events, keys) {
        const filterArray = [];
        filterArray.push(events.map(name => (0, Utils_1.toHex)(starknet_1.hash.starknetKeccak(name))));
        if (keys != null)
            keys.forEach(key => filterArray.push(key == null ? [] : [key]));
        return filterArray;
    }
    /**
     * Returns the events occuring in a single starknet block as identified by the contract and keys
     *
     * @param events
     * @param keys
     * @param blockHeight
     */
    getContractBlockEvents(events, keys, blockHeight) {
        const _super = Object.create(null, {
            getBlockEvents: { get: () => super.getBlockEvents }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const blockEvents = yield _super.getBlockEvents.call(this, this.root.contract.address, this.toFilter(events, keys), blockHeight);
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
