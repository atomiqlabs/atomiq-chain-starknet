import { ChainEvents, EventListener } from "@atomiqlabs/base";
import { StarknetSwapData } from "../swaps/StarknetSwapData";
import { StarknetSwapContract } from "../swaps/StarknetSwapContract";
import { Provider, SubscriptionStarknetEventsEvent, WebSocketChannel } from "starknet";
import { StarknetSpvVaultContract } from "../spv_swap/StarknetSpvVaultContract";
import { StarknetChainInterface } from "../chain/StarknetChainInterface";
/**
 * Current state of the starknet event listener, contains the last processed
 *  block number and transaction hash of the last processed event
 *
 * @category Events
 */
export type StarknetEventListenerState = {
    /**
     * Block number of the last processed event
     */
    lastBlockNumber: number;
    /**
     * Transaction hash of the last processed event
     */
    lastTxHash?: string;
};
/**
 * Starknet on-chain event handler for front-end systems without access to fs, uses WS or long-polling to subscribe, might lose
 *  out on some events if the network is unreliable, front-end systems should take this into consideration and not
 *  rely purely on events
 *
 * @category Events
 */
export declare class StarknetChainEventsBrowser implements ChainEvents<StarknetSwapData, StarknetEventListenerState[]> {
    private eventsProcessing;
    private processedEvents;
    /**
     * @internal
     */
    protected readonly Chain: StarknetChainInterface;
    /**
     * @internal
     */
    protected readonly listeners: EventListener<StarknetSwapData>[];
    /**
     * @internal
     */
    protected readonly wsChannel?: WebSocketChannel;
    /**
     * @internal
     */
    protected readonly provider: Provider;
    /**
     * @internal
     */
    protected readonly starknetSwapContract: StarknetSwapContract;
    /**
     * @internal
     */
    protected readonly starknetSpvVaultContract: StarknetSpvVaultContract;
    /**
     * @internal
     */
    protected readonly logger: import("../../utils/Utils").LoggerType;
    /**
     * @internal
     */
    protected escrowContractSubscription?: SubscriptionStarknetEventsEvent;
    /**
     * @internal
     */
    protected spvVaultContractSubscription?: SubscriptionStarknetEventsEvent;
    /**
     * @internal
     */
    protected stopped: boolean;
    /**
     * @internal
     */
    protected pollIntervalSeconds: number;
    private timeout;
    constructor(chainInterface: StarknetChainInterface, starknetSwapContract: StarknetSwapContract, starknetSpvVaultContract: StarknetSpvVaultContract, pollIntervalSeconds?: number);
    /**
     *
     * @param event
     * @private
     */
    private getEventFingerprint;
    /**
     *
     * @param event
     * @private
     */
    private addProcessedEvent;
    /**
     *
     * @param eventOrFingerprint
     * @private
     */
    private isEventProcessed;
    /**
     * Returns async getter for fetching on-demand initialize event swap data
     *
     * @param event
     * @param claimHandler
     * @private
     * @returns {() => Promise<StarknetSwapData>} getter to be passed to InitializeEvent constructor
     */
    private getSwapDataGetter;
    /**
     *
     * @param event
     * @private
     */
    private parseInitializeEvent;
    /**
     *
     * @param event
     * @private
     */
    private parseRefundEvent;
    /**
     *
     * @param event
     * @private
     */
    private parseClaimEvent;
    /**
     *
     * @param event
     * @private
     */
    private parseSpvOpenEvent;
    /**
     *
     * @param event
     * @private
     */
    private parseSpvDepositEvent;
    /**
     *
     * @param event
     * @private
     */
    private parseSpvFrontEvent;
    /**
     *
     * @param event
     * @private
     */
    private parseSpvClaimEvent;
    /**
     *
     * @param event
     * @private
     */
    private parseSpvCloseEvent;
    /**
     * Processes event as received from the chain, parses it & calls event listeners
     *
     * @param events
     * @param currentBlockNumber
     * @param currentBlockTimestamp
     * @private
     */
    private processEvents;
    /**
     *
     * @param currentBlock
     * @param lastTxHash
     * @param lastBlockNumber
     * @private
     */
    private checkEventsEcrowManager;
    private checkEventsSpvVaults;
    /**
     * @inheritDoc
     */
    poll(lastState?: StarknetEventListenerState[]): Promise<StarknetEventListenerState[]>;
    /**
     * Sets up event handlers listening for swap events over websocket
     *
     * @internal
     */
    protected setupPoll(lastState?: StarknetEventListenerState[], saveLatestProcessedBlockNumber?: (newState: StarknetEventListenerState[]) => Promise<void>): Promise<void>;
    /**
     * @internal
     */
    protected wsStarted: boolean;
    /**
     *
     * @private
     */
    private subscribeWsEscrowEvents;
    /**
     *
     * @private
     */
    private subscribeWsSpvVaultEvents;
    /**
     * @internal
     */
    protected setupWebsocket(): Promise<void>;
    /**
     * @inheritDoc
     */
    init(noAutomaticPoll?: boolean): Promise<void>;
    /**
     * Stops all event subscriptions and timers
     */
    stop(): Promise<void>;
    /**
     * @inheritDoc
     */
    registerListener(cbk: EventListener<StarknetSwapData>): void;
    /**
     * @inheritDoc
     */
    unregisterListener(cbk: EventListener<StarknetSwapData>): boolean;
}
