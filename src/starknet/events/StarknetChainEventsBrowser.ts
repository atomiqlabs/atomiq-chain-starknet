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
    bytes31SpanToBuffer,
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
        const claimHandler = this.starknetSwapContract.claimHandlersByAddress[event.params.claim_handler.toLowerCase()];
        if(claimHandler==null) {
            this.logger.warn("parseInitializeEvent("+escrowHash+"): Unknown claim handler with claim: "+event.params.claim_handler);
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
        const claimHandler = this.starknetSwapContract.claimHandlersByAddress[event.params.claim_handler.toLowerCase()];
        if(claimHandler==null) {
            this.logger.warn("parseClaimEvent("+escrowHash+"): Unknown claim handler with claim: "+event.params.claim_handler);
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
            const timestamp = event.blockNumber===currentBlockNumber ? currentBlockTimestamp : await getBlockTimestamp(event.blockNumber);
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

    /**
     * Sets up event handlers listening for swap events over websocket
     *
     * @protected
     */
    protected async setupPoll(lastBlockNumber?: number, saveLatestProcessedBlockNumber?: (blockNumber: number) => Promise<void>) {
        this.stopped = false;
        while(!this.stopped) {
            try {
                const currentBlock = await this.provider.getBlockWithTxHashes("latest");
                const currentBlockNumber: number = (currentBlock as any).block_number;
                if(lastBlockNumber!=null && currentBlockNumber>lastBlockNumber) {
                    const events = await this.starknetSwapContract.Events.getContractBlockEvents(
                        ["escrow_manager::events::Initialize", "escrow_manager::events::Claim", "escrow_manager::events::Refund"],
                        [],
                        lastBlockNumber+1,
                        currentBlockNumber
                    );
                    await this.processEvents(events, currentBlockNumber, currentBlock.timestamp);
                }
                lastBlockNumber = currentBlockNumber;
                if(saveLatestProcessedBlockNumber!=null) await saveLatestProcessedBlockNumber(lastBlockNumber);
            } catch (e) {
                this.logger.error("setupPoll(): Error during poll: ", e);
            }
            await timeoutPromise(this.pollIntervalSeconds*1000);
        }
    }

    init(): Promise<void> {
        this.setupPoll();
        return Promise.resolve();
    }

    async stop(): Promise<void> {
        this.stopped = true;
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
