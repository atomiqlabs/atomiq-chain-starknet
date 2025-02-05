import { Abi } from "abi-wan-kanabi";
import { EventToPrimitiveType, ExtractAbiEventNames } from "abi-wan-kanabi/dist/kanabi";
import { StarknetEvents } from "../../base/modules/StarknetEvents";
import { StarknetContractBase } from "../StarknetContractBase";
export type StarknetAbiEvent<TAbi extends Abi, TEventName extends ExtractAbiEventNames<TAbi>> = {
    name: TEventName;
    params: EventToPrimitiveType<TAbi, TEventName>;
    txHash: string;
    blockHash: string;
    blockNumber: number;
};
export declare class StarknetContractEvents<TAbi extends Abi> extends StarknetEvents {
    readonly root: StarknetContractBase<TAbi>;
    constructor(root: StarknetContractBase<TAbi>);
    private getAbiEvent;
    private toStarknetAbiEvents;
    private toFilter;
    /**
     * Returns the events occuring in a single starknet block as identified by the contract and keys
     *
     * @param events
     * @param keys
     * @param blockHeight
     */
    getContractBlockEvents<T extends ExtractAbiEventNames<TAbi>>(events: T[], keys: string[], blockHeight: number): Promise<StarknetAbiEvent<TAbi, T>[]>;
    /**
     * Runs a search forawrds in time, processing the events for a specific topic public key
     *
     * @param events
     * @param keys
     * @param processor called for every event, should return a value if the correct event was found, or null
     *  if the search should continue
     * @param abortSignal
     */
    findInContractEvents<T, TEvent extends ExtractAbiEventNames<TAbi>>(events: TEvent[], keys: string[], processor: (event: StarknetAbiEvent<TAbi, TEvent>) => Promise<T>, abortSignal?: AbortSignal): Promise<T>;
}
