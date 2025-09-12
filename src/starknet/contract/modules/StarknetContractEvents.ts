import {Abi} from "abi-wan-kanabi";
import {EventToPrimitiveType, ExtractAbiEventNames} from "abi-wan-kanabi/dist/kanabi";
import {StarknetEvent, StarknetEvents} from "../../chain/modules/StarknetEvents";
import {CallData, events, hash} from "starknet";
import {StarknetContractBase} from "../StarknetContractBase";
import {toHex} from "../../../utils/Utils";
import {StarknetChainInterface} from "../../chain/StarknetChainInterface";

export type StarknetAbiEvent<TAbi extends Abi, TEventName extends ExtractAbiEventNames<TAbi>> = {
    name: TEventName,
    params: EventToPrimitiveType<TAbi, TEventName>,
    txHash: string,
    blockHash: string,
    blockNumber: number,
    keys: string[],
    data: string[]
};

export class StarknetContractEvents<TAbi extends Abi> extends StarknetEvents {

    readonly contract: StarknetContractBase<TAbi>;
    readonly abi: TAbi;

    constructor(chainInterface: StarknetChainInterface, contract: StarknetContractBase<TAbi>, abi: TAbi) {
        super(chainInterface);
        this.contract = contract;
        this.abi = abi;
    }

    private toStarknetAbiEvents<T extends ExtractAbiEventNames<TAbi>>(blockEvents: StarknetEvent[]): StarknetAbiEvent<TAbi, T>[] {
        const abiEvents = events.getAbiEvents(this.abi);
        const abiStructs = CallData.getAbiStruct(this.abi);
        const abiEnums = CallData.getAbiEnum(this.abi);

        const result = events.parseEvents(blockEvents, abiEvents, abiStructs, abiEnums);
        if(result.length!==blockEvents.length) throw new Error("Invalid event detected, please check provided ABI");
        return result.map((value, index) => {
            const starknetEvent = blockEvents[index];
            const name = Object.keys(value)[0];
            return {
                name: name as T,
                txHash: starknetEvent.transaction_hash,
                params: value[name] as any,
                blockNumber: starknetEvent.block_number,
                blockHash: starknetEvent.block_hash,
                data: starknetEvent.data,
                keys: starknetEvent.keys
            }
        });
    }

    private toFilter<T extends ExtractAbiEventNames<TAbi>>(
        events: T[],
        keys: (string | null)[] | null,
    ): (string | null)[][] {
        const filterArray: (string | null)[][] = [];
        filterArray.push(events.map(name => {
            const arr = name.split(":");
            const eventName = arr[arr.length-1];
            return toHex(hash.starknetKeccak(eventName))
        }));
        if(keys!=null) keys.forEach(key => filterArray.push(key==null ? [] : [key]));
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
        keys: (string | null)[] | null,
        startBlockHeight?: number,
        endBlockHeight: number | undefined = startBlockHeight
    ): Promise<StarknetAbiEvent<TAbi, T>[]> {
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
        keys: (string | null)[] | null,
        processor: (event: StarknetAbiEvent<TAbi, TEvent>) => Promise<T | undefined>,
        abortSignal?: AbortSignal
    ) {
        return this.findInEvents<T>(this.contract.contract.address, this.toFilter(events, keys), async (events: StarknetEvent[]) => {
            const parsedEvents = this.toStarknetAbiEvents<TEvent>(events);
            for(let event of parsedEvents) {
                const result: T | undefined = await processor(event);
                if(result!=null) return result;
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
    public async findInContractEventsForward<T, TEvent extends ExtractAbiEventNames<TAbi>>(
        events: TEvent[],
        keys: (string | null)[] | null,
        processor: (event: StarknetAbiEvent<TAbi, TEvent>) => Promise<T>,
        abortSignal?: AbortSignal
    ) {
        return this.findInEventsForward<T>(this.contract.contract.address, this.toFilter(events, keys), async (events: StarknetEvent[]) => {
            const parsedEvents = this.toStarknetAbiEvents<TEvent>(events);
            for(let event of parsedEvents) {
                const result: T = await processor(event);
                if(result!=null) return result;
            }
        }, abortSignal);
    }

}

