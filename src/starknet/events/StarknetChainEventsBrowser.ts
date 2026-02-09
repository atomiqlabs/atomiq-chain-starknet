import {
    ChainEvent,
    ChainEvents,
    ChainSwapType,
    ClaimEvent,
    EventListener,
    InitializeEvent,
    RefundEvent, SpvVaultClaimEvent, SpvVaultCloseEvent, SpvVaultDepositEvent, SpvVaultFrontEvent, SpvVaultOpenEvent
} from "@atomiqlabs/base";
import {StarknetSwapData} from "../swaps/StarknetSwapData";
import {
    bigNumberishToBuffer,
    bytes31SpanToBuffer, findLastIndex,
    getLogger,
    onceAsync,
    toBigInt,
    toHex
} from "../../utils/Utils";
import {StarknetSwapContract} from "../swaps/StarknetSwapContract";
import {
    BigNumberish,
    BlockTag,
    hash,
    Provider,
    SubscriptionStarknetEventsEvent,
    TransactionFinalityStatus,
    WebSocketChannel
} from "starknet";
import {StarknetAbiEvent} from "../contract/modules/StarknetContractEvents";
import {EscrowManagerAbiType} from "../swaps/EscrowManagerAbi";
import {ExtractAbiFunctionNames} from "abi-wan-kanabi/dist/kanabi";
import {IClaimHandler} from "../swaps/handlers/claim/ClaimHandlers";
import {StarknetSpvVaultContract} from "../spv_swap/StarknetSpvVaultContract";
import {StarknetChainInterface} from "../chain/StarknetChainInterface";
import {SpvVaultContractAbiType} from "../spv_swap/SpvVaultContractAbi";
import {sha256} from "@noble/hashes/sha2";
import {Buffer} from "buffer";

const PROCESSED_EVENTS_BACKLOG = 5000;
const LOGS_SLIDING_WINDOW = 60;

/**
 * Current state of the starknet event listener, contains the last processed
 *  block number and transaction hash of the last processed event
 *
 * @category Events
 */
export type StarknetEventListenerState = {
    lastBlockNumber: number,
    lastTxHash?: string
};

/**
 * Starknet on-chain event handler for front-end systems without access to fs, uses WS or long-polling to subscribe, might lose
 *  out on some events if the network is unreliable, front-end systems should take this into consideration and not
 *  rely purely on events
 *
 * @category Events
 */
export class StarknetChainEventsBrowser implements ChainEvents<StarknetSwapData, StarknetEventListenerState[]> {

    private eventsProcessing: {
        [eventFingerprint: string]: Promise<void>
    } = {};
    private processedEvents: Set<string> = new Set();

    protected readonly Chain: StarknetChainInterface;
    protected readonly listeners: EventListener<StarknetSwapData>[] = [];
    protected readonly wsChannel?: WebSocketChannel;
    protected readonly provider: Provider;
    protected readonly starknetSwapContract: StarknetSwapContract;
    protected readonly starknetSpvVaultContract: StarknetSpvVaultContract;
    protected readonly logger = getLogger("StarknetChainEventsBrowser: ");

    protected escrowContractSubscription?: SubscriptionStarknetEventsEvent;
    protected spvVaultContractSubscription?: SubscriptionStarknetEventsEvent;

    protected stopped: boolean = true;
    protected pollIntervalSeconds: number;

    private timeout: any;

    constructor(
        chainInterface: StarknetChainInterface,
        starknetSwapContract: StarknetSwapContract,
        starknetSpvVaultContract: StarknetSpvVaultContract,
        pollIntervalSeconds: number = 5
    ) {
        this.Chain = chainInterface;
        this.wsChannel = chainInterface.wsChannel;
        this.provider = chainInterface.provider;
        this.starknetSwapContract = starknetSwapContract;
        this.starknetSpvVaultContract = starknetSpvVaultContract;
        this.pollIntervalSeconds = pollIntervalSeconds;
    }

    /**
     *
     * @param event
     * @private
     */
    private getEventFingerprint(event: {keys: string[], data: string[], txHash: string}): string {
        const eventData = Buffer.concat([
            ...event.keys.map(value => bigNumberishToBuffer(value, 32)),
            ...event.data.map(value => bigNumberishToBuffer(value, 32))
        ]);
        const fingerprint = Buffer.from(sha256(eventData));

        return event.txHash+":"+fingerprint.toString("hex");
    }

    /**
     *
     * @param event
     * @private
     */
    private addProcessedEvent(event: {keys: string[], data: string[], txHash: string}) {
        this.processedEvents.add(this.getEventFingerprint(event));
        if(this.processedEvents.size > PROCESSED_EVENTS_BACKLOG) this.processedEvents.delete(this.processedEvents.keys().next().value!);
    }

    /**
     *
     * @param eventOrFingerprint
     * @private
     */
    private isEventProcessed(eventOrFingerprint: {keys: string[], data: string[], txHash: string} | string): boolean {
        const eventFingerprint: string = typeof(eventOrFingerprint)==="string" ? eventOrFingerprint : this.getEventFingerprint(eventOrFingerprint);
        return this.processedEvents.has(eventFingerprint);
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
    ): () => Promise<StarknetSwapData | null> {
        return async () => {
            const trace = await this.Chain.Transactions.traceTransaction(event.txHash, event.blockHash);
            if(trace==null) return null;
            return this.starknetSwapContract.findInitSwapData(trace, event.params.escrow_hash, claimHandler);
        }
    }

    /**
     *
     * @param event
     * @private
     */
    private parseInitializeEvent(
        event: StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Initialize">
    ): InitializeEvent<StarknetSwapData> | null {
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
            onceAsync<StarknetSwapData | null>(this.getSwapDataGetter(event, claimHandler))
        );
    }

    /**
     *
     * @param event
     * @private
     */
    private parseRefundEvent(
        event: StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Refund">
    ): RefundEvent<StarknetSwapData> {
        const escrowHashBuffer = bigNumberishToBuffer(event.params.escrow_hash, 32);
        const escrowHash = escrowHashBuffer.toString("hex");
        this.logger.debug("RefundEvent claimHash: "+toHex(event.params.claim_data)+" escrowHash: "+escrowHash);
        return new RefundEvent<StarknetSwapData>(escrowHash);
    }

    /**
     *
     * @param event
     * @private
     */
    private parseClaimEvent(
        event: StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Claim">
    ): ClaimEvent<StarknetSwapData> | null {
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
     *
     * @param event
     * @private
     */
    private parseSpvOpenEvent(
        event: StarknetAbiEvent<SpvVaultContractAbiType, "spv_swap_vault::events::Opened">
    ): SpvVaultOpenEvent {
        const owner = toHex(event.params.owner);
        const vaultId = toBigInt(event.params.vault_id);
        const btcTxId = bigNumberishToBuffer(event.params.btc_tx_hash, 32).reverse().toString("hex");
        const vout = Number(toBigInt(event.params.vout));

        this.logger.debug("SpvOpenEvent owner: "+owner+" vaultId: "+vaultId+" utxo: "+btcTxId+":"+vout);
        return new SpvVaultOpenEvent(owner, vaultId, btcTxId, vout);
    }

    /**
     *
     * @param event
     * @private
     */
    private parseSpvDepositEvent(
        event: StarknetAbiEvent<SpvVaultContractAbiType, "spv_swap_vault::events::Deposited">
    ): SpvVaultDepositEvent {
        const owner = toHex(event.params.owner);
        const vaultId = toBigInt(event.params.vault_id);
        const amounts = [toBigInt(event.params.amounts["0"] as BigNumberish), toBigInt(event.params.amounts["1"] as BigNumberish)];
        const depositCount = Number(toBigInt(event.params.deposit_count));

        this.logger.debug("SpvDepositEvent owner: "+owner+" vaultId: "+vaultId+" depositCount: "+depositCount+" amounts: ", amounts);
        return new SpvVaultDepositEvent(owner, vaultId, amounts, depositCount);
    }

    /**
     *
     * @param event
     * @private
     */
    private parseSpvFrontEvent(
        event: StarknetAbiEvent<SpvVaultContractAbiType, "spv_swap_vault::events::Fronted">
    ): SpvVaultFrontEvent {
        const owner = toHex(event.params.owner);
        const vaultId = toBigInt(event.params.vault_id);
        const btcTxId = bigNumberishToBuffer(event.params.btc_tx_hash, 32).reverse().toString("hex");
        const recipient = toHex(event.params.recipient);
        const executionHash = toHex(event.params.execution_hash);
        const amounts = [toBigInt(event.params.amounts["0"] as BigNumberish), toBigInt(event.params.amounts["1"] as BigNumberish)];
        const frontingAddress = toHex(event.params.caller);

        this.logger.debug("SpvFrontEvent owner: "+owner+" vaultId: "+vaultId+" btcTxId: "+btcTxId+
            " recipient: "+recipient+" frontedBy: "+frontingAddress+" amounts: ", amounts);
        return new SpvVaultFrontEvent(owner, vaultId, btcTxId, recipient, executionHash, amounts, frontingAddress);
    }

    /**
     *
     * @param event
     * @private
     */
    private parseSpvClaimEvent(
        event: StarknetAbiEvent<SpvVaultContractAbiType, "spv_swap_vault::events::Claimed">
    ): SpvVaultClaimEvent {
        const owner = toHex(event.params.owner);
        const vaultId = toBigInt(event.params.vault_id);
        const btcTxId = bigNumberishToBuffer(event.params.btc_tx_hash, 32).reverse().toString("hex");
        const recipient = toHex(event.params.recipient);
        const executionHash = toHex(event.params.execution_hash);
        const amounts = [toBigInt(event.params.amounts["0"] as BigNumberish), toBigInt(event.params.amounts["1"] as BigNumberish)];
        const caller = toHex(event.params.caller);
        const frontingAddress = toHex(event.params.fronting_address);
        const withdrawCount = Number(toBigInt(event.params.withdraw_count));

        this.logger.debug("SpvClaimEvent owner: "+owner+" vaultId: "+vaultId+" btcTxId: "+btcTxId+" withdrawCount: "+withdrawCount+
            " recipient: "+recipient+" frontedBy: "+frontingAddress+" claimedBy: "+caller+" amounts: ", amounts);
        return new SpvVaultClaimEvent(owner, vaultId, btcTxId, recipient, executionHash, amounts, caller, frontingAddress, withdrawCount);
    }

    /**
     *
     * @param event
     * @private
     */
    private parseSpvCloseEvent(
        event: StarknetAbiEvent<SpvVaultContractAbiType, "spv_swap_vault::events::Closed">
    ): SpvVaultCloseEvent {
        const owner = toHex(event.params.owner);
        const vaultId = toBigInt(event.params.vault_id);
        const btcTxId = bigNumberishToBuffer(event.params.btc_tx_hash, 32).reverse().toString("hex");
        const error = bigNumberishToBuffer(event.params.error).toString();

        return new SpvVaultCloseEvent(owner, vaultId, btcTxId, error);
    }

    /**
     * Processes event as received from the chain, parses it & calls event listeners
     *
     * @param events
     * @param currentBlockNumber
     * @param currentBlockTimestamp
     * @private
     */
    private async processEvents(
        events : (StarknetAbiEvent<
            EscrowManagerAbiType,
            "escrow_manager::events::Initialize" | "escrow_manager::events::Refund" | "escrow_manager::events::Claim"
        > | StarknetAbiEvent<
            SpvVaultContractAbiType,
            "spv_swap_vault::events::Opened" | "spv_swap_vault::events::Deposited" | "spv_swap_vault::events::Fronted" | "spv_swap_vault::events::Claimed" | "spv_swap_vault::events::Closed"
        >)[],
        currentBlockNumber?: number,
        currentBlockTimestamp?: number
    ) {
        const blockTimestampsCache: {[blockNumber: string]: number} = {};
        const getBlockTimestamp: (blockNumber?: number) => Promise<number> = async (blockNumber?: number)=> {
            //Use current timestamp for events without block height (probably pre-confirmed)
            if(blockNumber==null) return Math.floor(Date.now() / 1000);
            if(currentBlockTimestamp!=null && blockNumber===currentBlockNumber)
                return currentBlockTimestamp;

            const blockNumberString = blockNumber.toString();
            blockTimestampsCache[blockNumberString] ??= await this.Chain.Blocks.getBlockTime(blockNumber);
            return blockTimestampsCache[blockNumberString];
        }

        for(let event of events) {
            const eventIdentifier = this.getEventFingerprint(event);

            if(this.isEventProcessed(eventIdentifier)) {
                this.logger.debug("processEvents(): skipping already processed event: "+eventIdentifier);
                continue;
            }

            let parsedEvent: ChainEvent<StarknetSwapData> | null;
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
                case "spv_swap_vault::events::Opened":
                    parsedEvent = this.parseSpvOpenEvent(event as any);
                    break;
                case "spv_swap_vault::events::Deposited":
                    parsedEvent = this.parseSpvDepositEvent(event as any);
                    break;
                case "spv_swap_vault::events::Fronted":
                    parsedEvent = this.parseSpvFrontEvent(event as any);
                    break;
                case "spv_swap_vault::events::Claimed":
                    parsedEvent = this.parseSpvClaimEvent(event as any);
                    break;
                case "spv_swap_vault::events::Closed":
                    parsedEvent = this.parseSpvCloseEvent(event as any);
                    break;
            }

            if(this.eventsProcessing[eventIdentifier]!=null) {
                this.logger.debug("processEvents(): awaiting event that is currently processing: "+eventIdentifier);
                await this.eventsProcessing[eventIdentifier];
                continue;
            }

            const promise = (async() => {
                if(parsedEvent==null) return;
                //We are not trusting pre-confs for events, so this shall never happen
                if(event.blockNumber==null) throw new Error("Event block number cannot be null!");
                const timestamp = await getBlockTimestamp(event.blockNumber);
                parsedEvent.meta = {
                    blockTime: timestamp,
                    txId: event.txHash,
                    timestamp //Maybe deprecated
                } as any;
                const eventsArr = [parsedEvent];
                for(let listener of this.listeners) {
                    await listener(eventsArr);
                }
                this.addProcessedEvent(event);
            })();

            this.eventsProcessing[eventIdentifier] = promise;
            try {
                await promise;
                delete this.eventsProcessing[eventIdentifier];
            } catch (e) {
                delete this.eventsProcessing[eventIdentifier];
                throw e;
            }
        }
    }

    /**
     *
     * @param currentBlock
     * @param lastTxHash
     * @param lastBlockNumber
     * @private
     */
    private async checkEventsEcrowManager(
        currentBlock: {timestamp: number, block_number: number},
        lastTxHash?: string,
        lastBlockNumber?: number
    ): Promise<StarknetEventListenerState> {
        const currentBlockNumber: number = currentBlock.block_number;
        lastBlockNumber ??= currentBlockNumber;
        if(currentBlockNumber < lastBlockNumber) {
            this.logger.warn(`checkEventsEscrowManager(): Sanity check triggered - not processing events, currentBlock: ${currentBlockNumber}, lastBlock: ${lastBlockNumber}`);
            return {lastTxHash, lastBlockNumber};
        }
        // this.logger.debug("checkEvents(EscrowManager): Requesting logs: "+logStartHeight+"...pending");
        let events = await this.starknetSwapContract.Events.getContractBlockEvents(
            ["escrow_manager::events::Initialize", "escrow_manager::events::Claim", "escrow_manager::events::Refund"],
            [],
            lastBlockNumber,
            null
        );
        if(lastTxHash!=null) {
            const latestProcessedEventIndex = findLastIndex(events, val => val.txHash===lastTxHash);
            if(latestProcessedEventIndex!==-1) {
                events.splice(0, latestProcessedEventIndex+1);
                this.logger.debug("checkEvents(EscrowManager): Splicing processed events, resulting size: "+events.length);
            }
        }
        if(events.length>0) {
            await this.processEvents(events, currentBlock?.block_number, currentBlock?.timestamp);
            const lastProcessed = events[events.length-1];
            lastTxHash = lastProcessed.txHash;
            const lastProcessedWithBlockHeightIndex = findLastIndex(events, val => val.blockNumber!=null);
            if(lastProcessedWithBlockHeightIndex!==-1) {
                const lastProcessedWithBlockHeight = events[lastProcessedWithBlockHeightIndex];
                if(lastProcessedWithBlockHeight.blockNumber! > lastBlockNumber)
                    lastBlockNumber = lastProcessedWithBlockHeight.blockNumber!;
            }
        } else if(currentBlockNumber - lastBlockNumber > LOGS_SLIDING_WINDOW) {
            lastTxHash = undefined;
            lastBlockNumber = currentBlockNumber - LOGS_SLIDING_WINDOW;
        }
        return {lastTxHash, lastBlockNumber};
    }

    protected async checkEventsSpvVaults(currentBlock: {timestamp: number, block_number: number}, lastTxHash?: string, lastBlockNumber?: number): Promise<StarknetEventListenerState> {
        const currentBlockNumber: number = currentBlock.block_number;
        lastBlockNumber ??= currentBlockNumber;
        if(currentBlockNumber < lastBlockNumber) {
            this.logger.warn(`checkEventsSpvVaults(): Sanity check triggered - not processing events, currentBlock: ${currentBlockNumber}, lastBlock: ${lastBlockNumber}`);
            return {lastTxHash, lastBlockNumber};
        }
        // this.logger.debug("checkEvents(SpvVaults): Requesting logs: "+logStartHeight+"...pending");
        let events = await this.starknetSpvVaultContract.Events.getContractBlockEvents(
            ["spv_swap_vault::events::Opened", "spv_swap_vault::events::Deposited", "spv_swap_vault::events::Closed", "spv_swap_vault::events::Fronted", "spv_swap_vault::events::Claimed"],
            [],
            lastBlockNumber,
            null
        );
        if(lastTxHash!=null) {
            const latestProcessedEventIndex = findLastIndex(events, val => val.txHash===lastTxHash);
            if(latestProcessedEventIndex!==-1) {
                events.splice(0, latestProcessedEventIndex+1);
                this.logger.debug("checkEvents(SpvVaults): Splicing processed events, resulting size: "+events.length);
            }
        }
        if(events.length>0) {
            await this.processEvents(events, currentBlock?.block_number, currentBlock?.timestamp);
            const lastProcessed = events[events.length-1];
            lastTxHash = lastProcessed.txHash;
            const lastProcessedWithBlockHeightIndex = findLastIndex(events, val => val.blockNumber!=null);
            if(lastProcessedWithBlockHeightIndex!==-1) {
                const lastProcessedWithBlockHeight = events[lastProcessedWithBlockHeightIndex];
                if(lastProcessedWithBlockHeight.blockNumber! > lastBlockNumber)
                    lastBlockNumber = lastProcessedWithBlockHeight.blockNumber!;
            }
        } else if(currentBlockNumber - lastBlockNumber > LOGS_SLIDING_WINDOW) {
            lastTxHash = undefined;
            lastBlockNumber = currentBlockNumber - LOGS_SLIDING_WINDOW;
        }
        return {lastTxHash, lastBlockNumber};
    }

    /**
     * @inheritDoc
     */
    async poll(lastState?: StarknetEventListenerState[]): Promise<StarknetEventListenerState[]> {
        lastState ??= [];

        const currentBlock = await this.Chain.Blocks.getBlock(BlockTag.LATEST);

        const resultEscrow = await this.checkEventsEcrowManager(currentBlock as any, lastState?.[0]?.lastTxHash, lastState?.[0]?.lastBlockNumber);
        const resultSpvVault = await this.checkEventsSpvVaults(currentBlock as any, lastState?.[1]?.lastTxHash, lastState?.[1]?.lastBlockNumber);

        return [
            resultEscrow,
            resultSpvVault
        ];
    }

    /**
     * Sets up event handlers listening for swap events over websocket
     *
     * @protected
     */
    protected async setupPoll(
        lastState?: StarknetEventListenerState[],
        saveLatestProcessedBlockNumber?: (newState: StarknetEventListenerState[]) => Promise<void>
    ) {
        let func: () => Promise<void>;
        func = async () => {
            await this.poll(lastState).then(newState => {
                lastState = newState;
                if(saveLatestProcessedBlockNumber!=null) return saveLatestProcessedBlockNumber(newState);
            }).catch(e => {
                this.logger.error("setupPoll(): Failed to fetch starknet log: ", e);
            });
            if(this.stopped) return;
            this.timeout = setTimeout(func, this.pollIntervalSeconds*1000);
        };
        await func();
    }

    protected wsStarted: boolean = false;

    /**
     *
     * @private
     */
    private async subscribeWsEscrowEvents() {
        let subscription: SubscriptionStarknetEventsEvent | undefined;
        do {
            try {
                subscription = await this.wsChannel!.subscribeEvents({
                    fromAddress: this.starknetSwapContract.contract.address,
                    keys: this.starknetSwapContract.Events.toFilter(
                      ["escrow_manager::events::Initialize", "escrow_manager::events::Claim", "escrow_manager::events::Refund"],
                      []
                    ),
                    finalityStatus: TransactionFinalityStatus.ACCEPTED_ON_L2
                });
            } catch (e) {
                this.logger.error("subscribeWsEscrowEvents(): Failed to subscribe to escrow events, retrying in 10 seconds...");
                await new Promise(resolve => setTimeout(resolve, 10*1000));
            }
        } while(subscription==null);

        subscription.on((event) => {
            const parsedEvents = this.starknetSwapContract.Events.toStarknetAbiEvents<
              "escrow_manager::events::Initialize" | "escrow_manager::events::Claim" | "escrow_manager::events::Refund"
            >([event]);
            this.processEvents(parsedEvents, event.block_number).catch(e => {
                console.error(`WS: EscrowContract: Failed to process event ${parsedEvents[0].txHash}:${parsedEvents[0].name}: `, e);
            });
        });
        this.escrowContractSubscription = subscription;

        this.logger.debug("subscribeWsEscrowEvents(): Successfully subscribed to escrow contract WS events");
    }

    /**
     *
     * @private
     */
    private async subscribeWsSpvVaultEvents() {
        let subscription: SubscriptionStarknetEventsEvent | undefined;
        do {
            try {
                subscription = await this.wsChannel!.subscribeEvents({
                    fromAddress: this.starknetSpvVaultContract.contract.address,
                    keys: this.starknetSpvVaultContract.Events.toFilter(
                      ["spv_swap_vault::events::Opened", "spv_swap_vault::events::Deposited", "spv_swap_vault::events::Closed", "spv_swap_vault::events::Fronted", "spv_swap_vault::events::Claimed"],
                      []
                    ),
                    finalityStatus: TransactionFinalityStatus.ACCEPTED_ON_L2
                });
            } catch (e) {
                this.logger.error("subscribeWsSpvVaultEvents(): Failed to subscribe to spv vault events, retrying in 10 seconds...");
                await new Promise(resolve => setTimeout(resolve, 10*1000));
            }
        } while(subscription==null);

        subscription.on((event) => {
            const parsedEvents = this.starknetSpvVaultContract.Events.toStarknetAbiEvents<
              "spv_swap_vault::events::Opened" | "spv_swap_vault::events::Deposited" | "spv_swap_vault::events::Closed" | "spv_swap_vault::events::Fronted" | "spv_swap_vault::events::Claimed"
            >([event]);
            this.processEvents(parsedEvents, event.block_number).catch(e => {
                console.error(`WS: SpvVaultContract: Failed to process event ${parsedEvents[0].txHash}:${parsedEvents[0].name}: `, e);
            });
        });
        this.spvVaultContractSubscription = subscription;

        this.logger.debug("subscribeWsSpvVaultEvents(): Successfully subscribed to spv vault contract WS events");
    }

    /**
     *
     * @protected
     */
    protected async setupWebsocket() {
        if(this.wsChannel==null) throw new Error("Tried to setup websocket subscription on a provider without WS");

        this.wsStarted = true;

        this.wsChannel.on("open", () => {
            this.logger.info("setupWebsocket(): Websocket connection opened!");
        });
        this.wsChannel.on("close", () => {
            this.logger.warn("setupWebsocket(): Websocket connection closed!");
        });
        this.wsChannel.on("error", (err) => {
            this.logger.error("setupWebsocket(): Websocket connection error: ", err);
        });

        //We don't await these, since they might block indefinitely
        this.subscribeWsEscrowEvents();
        this.subscribeWsSpvVaultEvents();
    }

    /**
     * @inheritDoc
     */
    async init(noAutomaticPoll?: boolean): Promise<void> {
        if(noAutomaticPoll) return;

        this.stopped = false;
        if(this.wsChannel!=null) {
            this.logger.debug("init(): WS channel detected, setting up websocket-based subscription!");
            await this.setupWebsocket();
        } else {
            this.logger.debug("init(): Setting up HTTP polling events subscription!");
            await this.setupPoll();
        }
    }

    /**
     * Stops all event subscriptions and timers
     */
    async stop(): Promise<void> {
        this.stopped = true;
        if(this.timeout!=null) clearTimeout(this.timeout);
        if(this.wsStarted) {
            if(this.escrowContractSubscription!=null) await this.escrowContractSubscription.unsubscribe();
            if(this.spvVaultContractSubscription!=null) await this.spvVaultContractSubscription.unsubscribe();
            this.wsStarted = false;
        }
    }

    /**
     * @inheritDoc
     */
    registerListener(cbk: EventListener<StarknetSwapData>): void {
        this.listeners.push(cbk);
    }

    /**
     * @inheritDoc
     */
    unregisterListener(cbk: EventListener<StarknetSwapData>): boolean {
        const index = this.listeners.indexOf(cbk);
        if(index>=0) {
            this.listeners.splice(index, 1);
            return true;
        }
        return false;
    }
}
