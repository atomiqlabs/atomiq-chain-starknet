import {Abi} from "abi-wan-kanabi";
import {EventToPrimitiveType, ExtractAbiEventNames} from "abi-wan-kanabi/dist/kanabi";
import {StarknetEvent, StarknetEvents} from "../../chain/modules/StarknetEvents";
import {CallData, events, hash, createAbiParser, AbiEvents, AbiStructs, AbiEnums} from "starknet";
import {StarknetContractBase} from "../StarknetContractBase";
import {toHex} from "../../../utils/Utils";
import {StarknetChainInterface} from "../../chain/StarknetChainInterface";

export type StarknetAbiEvent<TAbi extends Abi, TEventName extends ExtractAbiEventNames<TAbi>> = {
    name: TEventName,
    params: EventToPrimitiveType<TAbi, TEventName>,
    txHash: string,
    blockHash?: string,
    blockNumber?: number,
    keys: string[],
    data: string[]
};

export class StarknetContractEvents<TAbi extends Abi> extends StarknetEvents {

    readonly contract: StarknetContractBase<TAbi>;
    readonly abi: TAbi;
    readonly knownEventNames: string[];
    readonly abiEvents: AbiEvents;
    readonly abiStructs: AbiStructs;
    readonly abiEnums: AbiEnums;

    constructor(chainInterface: StarknetChainInterface, contract: StarknetContractBase<TAbi>, abi: TAbi) {
        super(chainInterface);
        this.contract = contract;
        this.abi = abi;
        this.abiEvents = events.getAbiEvents(this.abi);
        this.abiStructs = CallData.getAbiStruct(this.abi);
        this.abiEnums = CallData.getAbiEnum(this.abi);
        this.knownEventNames = Object.keys(this.abiEvents).map(hash => this.abiEvents[hash].name as string);
    }

    public toStarknetAbiEvents<T extends ExtractAbiEventNames<TAbi>>(blockEvents: StarknetEvent[]): StarknetAbiEvent<TAbi, T>[] {
        return blockEvents.map((starknetEvent) => {
            // Convert StarknetEvent to EMITTED_EVENT format expected by parseEvents
            const [value] = events.parseEvents(
                [{
                    ...starknetEvent,
                    transaction_index: starknetEvent.transaction_index ?? 0,
                    event_index: starknetEvent.event_index ?? 0
                }],
                this.abiEvents, this.abiStructs, this.abiEnums, createAbiParser(this.abi)
            );

            if(value==null) throw new Error("Invalid event detected, please check provided ABI");
            const name = Object.keys(value).find(name => this.knownEventNames.includes(name));
            if(name==null) throw new Error("Invalid event detected (name), please check provided ABI");

            const event: StarknetAbiEvent<TAbi, T> = {
                name: name as T,
                txHash: starknetEvent.transaction_hash,
                params: value[name] as any,
                blockNumber: starknetEvent.block_number,
                blockHash: starknetEvent.block_hash,
                data: starknetEvent.data,
                keys: starknetEvent.keys
            }
            // this.logger.debug("toStarknetAbiEvents(): Parsed event: ", event);
            return event;
        });
    }

    public toFilter<T extends ExtractAbiEventNames<TAbi>>(
        events: T[],
        keys: null | (null | string | string[])[],
    ): string[][] {
        const filterArray: string[][] = [];
        filterArray.push(events.map(name => {
            const arr = name.split(":");
            const eventName = arr[arr.length-1];
            return toHex(hash.starknetKeccak(eventName), 0)
        }));
        if(keys!=null) keys.forEach(key => filterArray.push(key==null ? [] : Array.isArray(key) ? key.map(k => toHex(k, 0)) : [toHex(key, 0)]));
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
    public async getContractBlockEvents<T extends ExtractAbiEventNames<TAbi>>(
        events: T[],
        keys: (null | string | string[])[],
        startBlockHeight?: number,
        endBlockHeight?: number | null
    ): Promise<StarknetAbiEvent<TAbi, T>[]> {
        if(endBlockHeight===undefined) endBlockHeight = startBlockHeight;
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
    public async findInContractEvents<T, TEvent extends ExtractAbiEventNames<TAbi>>(
        events: TEvent[],
        keys: null | (null | string | string[])[],
        processor: (event: StarknetAbiEvent<TAbi, TEvent>) => Promise<T | null>,
        abortSignal?: AbortSignal
    ) {
        return this.findInEvents<T>(this.contract.contract.address, this.toFilter(events, keys), async (events: StarknetEvent[]) => {
            const parsedEvents = this.toStarknetAbiEvents<TEvent>(events);
            for(let event of parsedEvents) {
                const result = await processor(event);
                if(result!=null) return result;
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
    public async findInContractEventsForward<T, TEvent extends ExtractAbiEventNames<TAbi>>(
        events: TEvent[],
        keys: null | (null | string | string[])[],
        processor: (event: StarknetAbiEvent<TAbi, TEvent>) => Promise<T | null>,
        startHeight?: number,
        abortSignal?: AbortSignal
    ) {
        return this.findInEventsForward<T>(this.contract.contract.address, this.toFilter(events, keys), async (events: StarknetEvent[]) => {
            const parsedEvents = this.toStarknetAbiEvents<TEvent>(events);
            for(let event of parsedEvents) {
                const result = await processor(event);
                if(result!=null) return result;
            }
            return null;
        }, startHeight, abortSignal);
    }

}

