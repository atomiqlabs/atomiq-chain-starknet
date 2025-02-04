import {StarknetTokens} from "./StarknetTokens";
import {StarknetModule} from "../StarknetModule";

export type StarknetEvent = {
    block_hash: string;
    block_number: number;
    transaction_hash: string;
    from_address: string;
    keys: string[];
    data: string[];
}

export class StarknetEvents extends StarknetModule {

    public readonly EVENTS_LIMIT = 100;

    /**
     * Gets the signatures for a given topicKey public key, if lastProcessedSignature is specified, it fetches only
     *  the signatures before this signature
     *
     * @param contract
     * @param keys
     * @param logFetchLimit
     * @param continuation
     * @private
     */
    private async getEvents(contract: string, keys: string[][], logFetchLimit: number, continuation?: string) {
        const eventsList = await this.root.provider.getEvents({
            address: contract,
            to_block: "latest",
            keys,
            chunk_size: logFetchLimit ?? this.EVENTS_LIMIT,
            continuation_token: continuation
        });

        return eventsList;
    }

    /**
     * Returns the events occuring in a single starknet block as identified by the contract and keys
     *
     * @param contract
     * @param keys
     * @param blockHeight
     */
    public async getBlockEvents(contract: string, keys: string[][], blockHeight: number): Promise<StarknetEvent[]> {
        const events: StarknetEvent[] = [];
        let result = null;
        while(result==null || result?.continuation_token!=null) {
            result = await this.root.provider.getEvents({
                address: contract,
                from_block: {block_number: blockHeight},
                to_block: {block_number: blockHeight},
                keys,
                chunk_size: this.EVENTS_LIMIT,
                continuation_token: result?.continuation_token
            });
            events.push(...result.events);
        }
        return events;
    }

    //TODO: This currently works differently from Solana implementation, as it paginates forward in time
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
    public async findInSignatures<T>(
        contract: string, keys: string[][],
        processor: (signatures: StarknetEvent[]) => Promise<T>,
        abortSignal?: AbortSignal,
        logFetchLimit?: number
    ): Promise<T> {
        if(logFetchLimit==null || logFetchLimit>this.EVENTS_LIMIT) logFetchLimit = this.EVENTS_LIMIT;
        let eventsResult = null;
        while(eventsResult==null || eventsResult?.continuation_token!=null) {
            eventsResult = await this.getEvents(contract, keys, logFetchLimit, eventsResult?.continuation_token);
            if(abortSignal!=null) abortSignal.throwIfAborted();
            const result: T = await processor(eventsResult.events);
            if(result!=null) return result;
        }
        return null;
    }

}