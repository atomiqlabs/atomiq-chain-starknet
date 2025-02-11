import { ChainEvents, ClaimEvent, EventListener, InitializeEvent, RefundEvent } from "@atomiqlabs/base";
import { StarknetSwapData } from "../swaps/StarknetSwapData";
import { StarknetSwapContract } from "../swaps/StarknetSwapContract";
import { BigNumberish, Provider } from "starknet";
import { StarknetAbiEvent } from "../contract/modules/StarknetContractEvents";
import { EscrowManagerAbiType } from "../swaps/EscrowManagerAbi";
import { ExtractAbiFunctionNames } from "abi-wan-kanabi/dist/kanabi";
import { IClaimHandler } from "../swaps/handlers/claim/ClaimHandlers";
export type StarknetTraceCall = {
    calldata: string[];
    contract_address: string;
    entry_point_selector: string;
    calls: StarknetTraceCall[];
};
/**
 * Solana on-chain event handler for front-end systems without access to fs, uses pure WS to subscribe, might lose
 *  out on some events if the network is unreliable, front-end systems should take this into consideration and not
 *  rely purely on events
 */
export declare class StarknetChainEventsBrowser implements ChainEvents<StarknetSwapData> {
    protected readonly listeners: EventListener<StarknetSwapData>[];
    protected readonly provider: Provider;
    protected readonly starknetSwapContract: StarknetSwapContract;
    protected eventListeners: number[];
    protected readonly logger: {
        debug: (msg: any, ...args: any[]) => void;
        info: (msg: any, ...args: any[]) => void;
        warn: (msg: any, ...args: any[]) => void;
        error: (msg: any, ...args: any[]) => void;
    };
    protected initFunctionName: ExtractAbiFunctionNames<EscrowManagerAbiType>;
    protected initEntryPointSelector: string;
    protected stopped: boolean;
    protected pollIntervalSeconds: number;
    private timeout;
    constructor(starknetSwapContract: StarknetSwapContract, pollIntervalSeconds?: number);
    findInitSwapData(call: StarknetTraceCall, escrowHash: BigNumberish, claimHandler: IClaimHandler<any, any>): StarknetSwapData;
    /**
     * Returns async getter for fetching on-demand initialize event swap data
     *
     * @param event
     * @param claimHandler
     * @private
     * @returns {() => Promise<StarknetSwapData>} getter to be passed to InitializeEvent constructor
     */
    private getSwapDataGetter;
    protected parseInitializeEvent(event: StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Initialize">): InitializeEvent<StarknetSwapData>;
    protected parseRefundEvent(event: StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Refund">): RefundEvent<StarknetSwapData>;
    protected parseClaimEvent(event: StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Claim">): ClaimEvent<StarknetSwapData>;
    /**
     * Processes event as received from the chain, parses it & calls event listeners
     *
     * @param events
     * @param currentBlockNumber
     * @param currentBlockTimestamp
     * @protected
     */
    protected processEvents(events: StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Initialize" | "escrow_manager::events::Refund" | "escrow_manager::events::Claim">[], currentBlockNumber: number, currentBlockTimestamp: number): Promise<void>;
    protected checkEvents(lastBlockNumber: number, lastTxHash: string): Promise<{
        txHash: string;
        blockNumber: number;
    }>;
    /**
     * Sets up event handlers listening for swap events over websocket
     *
     * @protected
     */
    protected setupPoll(lastBlockNumber?: number, lastTxHash?: string, saveLatestProcessedBlockNumber?: (blockNumber: number, lastTxHash: string) => Promise<void>): Promise<void>;
    init(): Promise<void>;
    stop(): Promise<void>;
    registerListener(cbk: EventListener<StarknetSwapData>): void;
    unregisterListener(cbk: EventListener<StarknetSwapData>): boolean;
}
