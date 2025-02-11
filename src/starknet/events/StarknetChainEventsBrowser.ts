import {
    ChainEvents,
    ChainSwapType,
    ClaimEvent,
    EventListener,
    InitializeEvent,
    RefundEvent,
    SwapEvent
} from "@atomiqlabs/base";
import {StarknetSwapData} from "../swaps/StarknetSwapData";
import {
    bigNumberishToBuffer,
    bytes31SpanToBuffer, findLastIndex,
    getLogger,
    onceAsync,
    parseInitFunctionCalldata,
    timeoutPromise,
    toHex
} from "../../utils/Utils";
import {StarknetSwapContract} from "../swaps/StarknetSwapContract";
import {BigNumberish, hash, Provider} from "starknet";
import {StarknetAbiEvent} from "../contract/modules/StarknetContractEvents";
import {EscrowManagerAbiType} from "../swaps/EscrowManagerAbi";
import {ExtractAbiFunctionNames} from "abi-wan-kanabi/dist/kanabi";
import {IClaimHandler} from "../swaps/handlers/claim/ClaimHandlers";

export type StarknetTraceCall = {
    calldata: string[],
    contract_address: string,
    entry_point_selector: string,
    calls: StarknetTraceCall[]
};

/**
 * Solana on-chain event handler for front-end systems without access to fs, uses pure WS to subscribe, might lose
 *  out on some events if the network is unreliable, front-end systems should take this into consideration and not
 *  rely purely on events
 */
export class StarknetChainEventsBrowser implements ChainEvents<StarknetSwapData> {

    protected readonly listeners: EventListener<StarknetSwapData>[] = [];
    protected readonly provider: Provider;
    protected readonly starknetSwapContract: StarknetSwapContract;
    protected eventListeners: number[] = [];
    protected readonly logger = getLogger("StarknetChainEventsBrowser: ");

    protected initFunctionName: ExtractAbiFunctionNames<EscrowManagerAbiType> = "initialize";
    protected initEntryPointSelector = toHex(hash.starknetKeccak(this.initFunctionName));

    protected stopped: boolean;
    protected pollIntervalSeconds: number;

    private timeout: NodeJS.Timeout;

    constructor(starknetSwapContract: StarknetSwapContract, pollIntervalSeconds: number = 5) {
        this.provider = starknetSwapContract.provider;
        this.starknetSwapContract = starknetSwapContract;
        this.pollIntervalSeconds = pollIntervalSeconds;
    }

    findInitSwapData(call: StarknetTraceCall, escrowHash: BigNumberish, claimHandler: IClaimHandler<any, any>): StarknetSwapData {
        if(
            call.contract_address===this.starknetSwapContract.contract.address &&
            call.entry_point_selector===this.initEntryPointSelector
        ) {
            //Found, check correct escrow hash
            const {escrow, extraData} = parseInitFunctionCalldata(call.calldata, claimHandler);
            if(toHex(escrow.getEscrowHash())===toHex(escrowHash)) {
                if(extraData.length!==0) {
                    escrow.setExtraData(bytes31SpanToBuffer(extraData, 42).toString("hex"));
                }
                return escrow;
            }
        }
        for(let _call of call.calls) {
            const found = this.findInitSwapData(_call, escrowHash, claimHandler);
            if(found!=null) return found;
        }
        return null;
    }

    /**
     * Returns async getter for fetching on-demand initialize event swap data
     *
     * @param event
     * @param claimHandler
     * @private
     * @returns {() => Promise<StarknetSwapData>} getter to be passed to InitializeEvent constructor
     */
    private getSwapDataGetter(
        event: StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Initialize">,
        claimHandler: IClaimHandler<any, any>
    ): () => Promise<StarknetSwapData> {
        return async () => {
            const trace = await this.provider.getTransactionTrace(event.txHash);
            if(trace.invoke_tx_trace==null) return null;
            if((trace.invoke_tx_trace.execute_invocation as any).revert_reason!=null) return null;
            return this.findInitSwapData(trace.invoke_tx_trace.execute_invocation as any, event.params.escrow_hash, claimHandler);
        }
    }

    protected parseInitializeEvent(
        event: StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Initialize">
    ): InitializeEvent<StarknetSwapData> {
        const escrowHashBuffer = bigNumberishToBuffer(event.params.escrow_hash, 32);
        const escrowHash = escrowHashBuffer.toString("hex");
        const claimHandlerHex = toHex(event.params.claim_handler);
        const claimHandler = this.starknetSwapContract.claimHandlersByAddress[claimHandlerHex];
        if(claimHandler==null) {
            this.logger.warn("parseInitializeEvent("+escrowHash+"): Unknown claim handler with claim: "+claimHandlerHex);
            return null;
        }
        const swapType: ChainSwapType = claimHandler.getType();

        this.logger.debug("InitializeEvent claimHash: "+toHex(event.params.claim_data)+" escrowHash: "+escrowHash);
        return new InitializeEvent<StarknetSwapData>(
            escrowHash,
            swapType,
            onceAsync<StarknetSwapData>(this.getSwapDataGetter(event, claimHandler))
        );
    }

    protected parseRefundEvent(
        event: StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Refund">
    ): RefundEvent<StarknetSwapData> {
        const escrowHashBuffer = bigNumberishToBuffer(event.params.escrow_hash, 32);
        const escrowHash = escrowHashBuffer.toString("hex");
        this.logger.debug("RefundEvent claimHash: "+toHex(event.params.claim_data)+" escrowHash: "+escrowHash);
        return new RefundEvent<StarknetSwapData>(escrowHash);
    }

    protected parseClaimEvent(
        event: StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Claim">
    ): ClaimEvent<StarknetSwapData> {
        const escrowHashBuffer = bigNumberishToBuffer(event.params.escrow_hash, 32);
        const escrowHash = escrowHashBuffer.toString("hex");
        const claimHandlerHex = toHex(event.params.claim_handler);
        const claimHandler = this.starknetSwapContract.claimHandlersByAddress[claimHandlerHex];
        if(claimHandler==null) {
            this.logger.warn("parseClaimEvent("+escrowHash+"): Unknown claim handler with claim: "+claimHandlerHex);
            return null;
        }
        const witnessResult = claimHandler.parseWitnessResult(event.params.witness_result);
        this.logger.debug("ClaimEvent claimHash: "+toHex(event.params.claim_data)+
            " witnessResult: "+witnessResult+" escrowHash: "+escrowHash);
        return new ClaimEvent<StarknetSwapData>(escrowHash, witnessResult);
    }

    /**
     * Processes event as received from the chain, parses it & calls event listeners
     *
     * @param events
     * @param currentBlockNumber
     * @param currentBlockTimestamp
     * @protected
     */
    protected async processEvents(
        events : StarknetAbiEvent<
            EscrowManagerAbiType,
            "escrow_manager::events::Initialize" | "escrow_manager::events::Refund" | "escrow_manager::events::Claim"
        >[],
        currentBlockNumber: number,
        currentBlockTimestamp: number
    ) {
        const blockTimestampsCache: {[blockNumber: string]: number} = {};
        const getBlockTimestamp: (blockNumber: number) => Promise<number> = async (blockNumber: number)=> {
            const blockNumberString = blockNumber.toString();
            blockTimestampsCache[blockNumberString] ??= (await this.provider.getBlockWithTxHashes(blockNumber)).timestamp;
            return blockTimestampsCache[blockNumberString];
        }

        const parsedEvents: SwapEvent<StarknetSwapData>[] = [];

        for(let event of events) {
            let parsedEvent: SwapEvent<StarknetSwapData>;
            switch(event.name) {
                case "escrow_manager::events::Claim":
                    parsedEvent = this.parseClaimEvent(event as any);
                    break;
                case "escrow_manager::events::Refund":
                    parsedEvent = this.parseRefundEvent(event as any);
                    break;
                case "escrow_manager::events::Initialize":
                    parsedEvent = this.parseInitializeEvent(event as any);
                    break;
            }
            const timestamp = (event.blockNumber==null || event.blockNumber===currentBlockNumber) ? currentBlockTimestamp : await getBlockTimestamp(event.blockNumber);
            parsedEvent.meta = {
                blockTime: timestamp,
                txId: event.txHash,
                timestamp //Maybe deprecated
            } as any;
            parsedEvents.push(parsedEvent);
        }

        for(let listener of this.listeners) {
            await listener(parsedEvents);
        }
    }

    protected async checkEvents(lastBlockNumber: number, lastTxHash: string): Promise<{txHash: string, blockNumber: number}> {
        //Get pending events
        let pendingEvents = await this.starknetSwapContract.Events.getContractBlockEvents(
            ["escrow_manager::events::Initialize", "escrow_manager::events::Claim", "escrow_manager::events::Refund"],
            []
        );
        if(lastTxHash!=null) {
            const latestProcessedEventIndex = findLastIndex(pendingEvents, val => val.txHash===lastTxHash);
            if(latestProcessedEventIndex!==-1) pendingEvents.splice(0, latestProcessedEventIndex+1);
        }
        if(pendingEvents.length>0) {
            await this.processEvents(pendingEvents, null, Math.floor(Date.now()/1000));
            lastTxHash = pendingEvents[pendingEvents.length-1].txHash;
        }

        const currentBlock = await this.provider.getBlockWithTxHashes("latest");
        const currentBlockNumber: number = (currentBlock as any).block_number;
        if(lastBlockNumber!=null && currentBlockNumber>lastBlockNumber) {
            const events = await this.starknetSwapContract.Events.getContractBlockEvents(
                ["escrow_manager::events::Initialize", "escrow_manager::events::Claim", "escrow_manager::events::Refund"],
                [],
                lastBlockNumber+1,
                currentBlockNumber
            );
            if(lastTxHash!=null) {
                const latestProcessedEventIndex = findLastIndex(events, val => val.txHash === lastTxHash);
                if (latestProcessedEventIndex !== -1) events.splice(0, latestProcessedEventIndex + 1);
            }
            if(events.length>0) {
                await this.processEvents(events, currentBlockNumber, currentBlock.timestamp);
                lastTxHash = events[events.length - 1].txHash;
            }
        }
        return {
            txHash: lastTxHash,
            blockNumber: currentBlockNumber
        };
    }

    /**
     * Sets up event handlers listening for swap events over websocket
     *
     * @protected
     */
    protected async setupPoll(
        lastBlockNumber?: number,
        lastTxHash?: string,
        saveLatestProcessedBlockNumber?: (blockNumber: number, lastTxHash: string) => Promise<void>
    ) {
        this.stopped = false;
        let func;
        func = async () => {
            await this.checkEvents(lastBlockNumber, lastTxHash).then(({blockNumber, txHash}) => {
                lastBlockNumber = blockNumber;
                lastTxHash = txHash;
                if(saveLatestProcessedBlockNumber!=null) return saveLatestProcessedBlockNumber(blockNumber, lastTxHash);
            }).catch(e => {
                this.logger.error("setupPoll(): Failed to fetch starknet log: ", e);
            });
            if(this.stopped) return;
            this.timeout = setTimeout(func, this.pollIntervalSeconds*1000);
        };
        await func();
    }

    init(): Promise<void> {
        this.setupPoll();
        return Promise.resolve();
    }

    async stop(): Promise<void> {
        this.stopped = true;
        if(this.timeout!=null) clearTimeout(this.timeout);
        this.eventListeners = [];
    }

    registerListener(cbk: EventListener<StarknetSwapData>): void {
        this.listeners.push(cbk);
    }

    unregisterListener(cbk: EventListener<StarknetSwapData>): boolean {
        const index = this.listeners.indexOf(cbk);
        if(index>=0) {
            this.listeners.splice(index, 1);
            return true;
        }
        return false;
    }
}
