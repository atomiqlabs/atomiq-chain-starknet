import { ChainEvents, EventListener } from "@atomiqlabs/base";
import { StarknetSwapData } from "../swaps/StarknetSwapData";
import { StarknetSwapContract } from "../swaps/StarknetSwapContract";
import { Provider, SubscriptionStarknetEventsEvent, WebSocketChannel } from "starknet";
import { EscrowManagerAbiType } from "../swaps/EscrowManagerAbi";
import { ExtractAbiFunctionNames } from "abi-wan-kanabi/dist/kanabi";
import { StarknetSpvVaultContract } from "../spv_swap/StarknetSpvVaultContract";
import { StarknetChainInterface } from "../chain/StarknetChainInterface";
/**
 * Current state of the starknet event listener, contains the last processed
 *  block number and transaction hash of the last processed event
 *
 * @category Events
 */
export type StarknetEventListenerState = {
    lastBlockNumber: number;
    lastTxHash?: string;
};
/**
 * Starknet on-chain event handler for front-end systems without access to fs, uses WS or long-polling to subscribe, might lose
 *  out on some events if the network is unreliable, front-end systems should take this into consideration and not
 *  rely purely on events
 *
 * @category Events
 */
export declare class StarknetChainEventsBrowser implements ChainEvents<StarknetSwapData> {
    private eventsProcessing;
    private processedEvents;
    protected readonly Chain: StarknetChainInterface;
    protected readonly listeners: EventListener<StarknetSwapData>[];
    protected readonly wsChannel?: WebSocketChannel;
    protected readonly provider: Provider;
    protected readonly starknetSwapContract: StarknetSwapContract;
    protected readonly starknetSpvVaultContract: StarknetSpvVaultContract;
    protected readonly logger: import("../../utils/Utils").LoggerType;
    protected escrowContractSubscription?: SubscriptionStarknetEventsEvent;
    protected spvVaultContractSubscription?: SubscriptionStarknetEventsEvent;
    protected initFunctionName: ExtractAbiFunctionNames<EscrowManagerAbiType>;
    protected initEntryPointSelector: bigint;
    protected stopped: boolean;
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
     *
     * @param call
     * @param escrowHash
     * @param claimHandler
     * @private
     */
    private findInitSwapData;
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
    protected checkEventsSpvVaults(currentBlock: {
        timestamp: number;
        block_number: number;
    }, lastTxHash?: string, lastBlockNumber?: number): Promise<StarknetEventListenerState>;
    /**
     *
     * @param lastState
     * @private
     */
    private checkEvents;
    /**
     * Sets up event handlers listening for swap events over websocket
     *
     * @protected
     */
    protected setupPoll(lastState?: StarknetEventListenerState[], saveLatestProcessedBlockNumber?: (newState: StarknetEventListenerState[]) => Promise<void>): Promise<void>;
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
     *
     * @protected
     */
    protected setupWebsocket(): Promise<void>;
    /**
     * @inheritDoc
     */
    init(): Promise<void>;
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
