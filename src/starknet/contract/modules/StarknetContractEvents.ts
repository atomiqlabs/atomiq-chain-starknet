import {Abi} from "abi-wan-kanabi";
import {EventToPrimitiveType, ExtractAbiEventNames} from "abi-wan-kanabi/dist/kanabi";
import {StarknetEvent, StarknetEvents} from "../../base/modules/StarknetEvents";
import {AbiEvent, AbiEvents, CallData, events, hash} from "starknet";
import {ERC20Abi} from "../../base/modules/ERC20Abi";
import {StarknetContractBase} from "../StarknetContractBase";
import {toHex} from "../../../utils/Utils";

export type StarknetAbiEvent<TAbi extends Abi, TEventName extends ExtractAbiEventNames<TAbi>> = {
    name: TEventName,
    params: EventToPrimitiveType<TAbi, TEventName>,
    txHash: string,
    blockHash: string,
    blockNumber: number
};

export class StarknetContractEvents<TAbi extends Abi> extends StarknetEvents {

    readonly root: StarknetContractBase<TAbi>;
    readonly abi: TAbi;

    constructor(root: StarknetContractBase<TAbi>, abi: TAbi) {
        super(root);
        this.abi = abi;
    }

    private getAbiEvent(abiEvents: AbiEvents, keys: string[]): AbiEvent {
        let abiEvent = abiEvents[keys[0] ?? 0];
        if (!abiEvent) {
            return null;
        }
        let i = 1;
        while (!abiEvent.name) {
            const hashName = keys[i];
            if(hashName==null) throw new Error('Not enough data in "key" property of this event.');
            abiEvent = abiEvent[hashName];
            i++;
        }
    }

    private toStarknetAbiEvents<T extends ExtractAbiEventNames<TAbi>>(blockEvents: StarknetEvent[]): StarknetAbiEvent<TAbi, T>[] {
        const abiEvents = events.getAbiEvents(this.abi);
        const abiStructs = CallData.getAbiStruct(this.abi);
        const abiEnums = CallData.getAbiEnum(this.abi);

        const decodedAbiEvents = blockEvents.map(val => this.getAbiEvent(abiEvents, val.keys));

        const result = events.parseEvents(blockEvents, abiEvents, abiStructs, abiEnums);
        if(result.length!==blockEvents.length) throw new Error("Invalid event detected, please check provided ABI");
        return result.map((value, index) => {
            const decodedAbiEvent = decodedAbiEvents[index];
            const starknetEvent = blockEvents[index];
            return {
                name: decodedAbiEvent.name as T,
                txHash: starknetEvent.transaction_hash,
                params: value as any,
                blockNumber: starknetEvent.block_number,
                blockHash: starknetEvent.block_hash
            }
        });
    }

    private toFilter<T extends ExtractAbiEventNames<TAbi>>(
        events: T[],
        keys: string[],
    ): string[][] {
        const filterArray: string[][] = [];
        filterArray.push(events.map(name => {
            const arr = name.split(":");
            const eventName = arr[arr.length-1];
            return toHex(hash.starknetKeccak(eventName))
        }));
        if(keys!=null) keys.forEach(key => filterArray.push(key==null ? [] : [key]));
        return filterArray;
    }

    /**
     * Returns the events occuring in a range of starknet block as identified by the contract and keys
     *
     * @param events
     * @param keys
     * @param startBlockHeight
     * @param endBlockHeight
     */
    public async getContractBlockEvents<T extends ExtractAbiEventNames<TAbi>>(
        events: T[],
        keys: string[],
        startBlockHeight: number,
        endBlockHeight: number = startBlockHeight
    ): Promise<StarknetAbiEvent<TAbi, T>[]> {
        const blockEvents = await super.getBlockEvents(this.root.contract.address, this.toFilter(events, keys), startBlockHeight, endBlockHeight);
        return this.toStarknetAbiEvents(blockEvents);
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
    public async findInContractEvents<T, TEvent extends ExtractAbiEventNames<TAbi>>(
        events: TEvent[],
        keys: string[],
        processor: (event: StarknetAbiEvent<TAbi, TEvent>) => Promise<T>,
        abortSignal?: AbortSignal
    ) {
        return this.findInEvents<T>(this.root.contract.address, this.toFilter(events, keys), async (events: StarknetEvent[]) => {
            const parsedEvents = this.toStarknetAbiEvents<TEvent>(events);
            for(let event of parsedEvents) {
                const result: T = await processor(event);
                if(result!=null) return result;
            }
        }, abortSignal);
    }

}

