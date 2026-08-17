import {StarknetChainEventsBrowser, StarknetEventListenerState} from "./StarknetChainEventsBrowser";
//@ts-ignore
import * as fs from "fs/promises";
import {StarknetSwapContract} from "../swaps/StarknetSwapContract";
import {StarknetChainInterface} from "../chain/StarknetChainInterface";
import {StarknetSpvVaultContract} from "../spv_swap/StarknetSpvVaultContract";

const BLOCKHEIGHT_FILENAME = "/strk-blockheight.txt";

export class StarknetChainEvents extends StarknetChainEventsBrowser {

    private readonly directory: string;

    constructor(
        directory: string,
        chainInterface: StarknetChainInterface,
        starknetSwapContract: StarknetSwapContract,
        starknetSpvVaultContract: StarknetSpvVaultContract,
        pollIntervalSeconds?: number
    ) {
        super(chainInterface, starknetSwapContract, starknetSpvVaultContract, pollIntervalSeconds);
        this.directory = directory;
    }

    /**
     * Retrieves last signature & slot from filesystem
     *
     * @private
     */
    private async getLastEventData(): Promise<StarknetEventListenerState[]> {
        try {
            const txt: string = (await fs.readFile(this.directory+BLOCKHEIGHT_FILENAME)).toString();
            const arr = txt.split(",");
            if(arr.length<2) {
                const blockNumber = parseInt(arr[0].split(";")[0]);
                if(isNaN(blockNumber)) throw new Error("Cannot parse the integer, is NaN!");
                return [
                    {lastBlockNumber: blockNumber},
                    {lastBlockNumber: blockNumber}
                ];
            }

            return arr.map(arrValue => {
                const subArray = arrValue.split(";");
                const lastBlockNumber = parseInt(subArray[0]);
                if(isNaN(lastBlockNumber)) throw new Error("Cannot parse the integer, is NaN!");
                return {lastBlockNumber, lastTxHash: subArray[1]};
            })
        } catch (e) {
            return [];
        }
    }

    /**
     * Saves last signature & slot to the filesystem
     *
     * @private
     */
    private async saveLastEventData(newState: StarknetEventListenerState[]): Promise<void> {
        const filename = this.directory+BLOCKHEIGHT_FILENAME;
        const content = newState.map(
            value => value.lastTxHash==null
                ? value.lastBlockNumber.toString(10)
                : value.lastBlockNumber.toString(10)+";"+value.lastTxHash
        ).join(",");
        const tmp = `${filename}.${Math.floor(Math.random() * 2**32)}.tmp`;

        try {
            await fs.writeFile(tmp, content, {
                flag: 'wx',
                flush: true, //fsync
            });

            //Rename atomically
            await fs.rename(tmp, filename);
        } catch (e) {
            //Remove tmp file on failure
            try {
                await fs.unlink(tmp)
            } catch (e) {}
            throw e;
        }
    }

    /**
     * @inheritDoc
     */
    async init(noAutomaticPoll?: boolean): Promise<void> {
        if(noAutomaticPoll) return;

        this.stopped = false;
        const lastEventsState = await this.getLastEventData();
        if(this.wsChannel!=null) await this.setupWebsocket();
        await this.setupPoll(
            lastEventsState,
            (newState: StarknetEventListenerState[]) => this.saveLastEventData(newState)
        );
    }

}