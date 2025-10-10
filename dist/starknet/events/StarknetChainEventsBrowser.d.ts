import { ChainEvents, ClaimEvent, EventListener, InitializeEvent, RefundEvent, SpvVaultClaimEvent, SpvVaultCloseEvent, SpvVaultDepositEvent, SpvVaultFrontEvent, SpvVaultOpenEvent } from "@atomiqlabs/base";
import { StarknetSwapData } from "../swaps/StarknetSwapData";
import { StarknetSwapContract } from "../swaps/StarknetSwapContract";
import { BigNumberish, Provider } from "starknet";
import { StarknetAbiEvent } from "../contract/modules/StarknetContractEvents";
import { EscrowManagerAbiType } from "../swaps/EscrowManagerAbi";
import { ExtractAbiFunctionNames } from "abi-wan-kanabi/dist/kanabi";
import { IClaimHandler } from "../swaps/handlers/claim/ClaimHandlers";
import { StarknetSpvVaultContract } from "../spv_swap/StarknetSpvVaultContract";
import { StarknetChainInterface } from "../chain/StarknetChainInterface";
import { SpvVaultContractAbiType } from "../spv_swap/SpvVaultContractAbi";
export type StarknetTraceCall = {
    calldata: string[];
    contract_address: string;
    entry_point_selector: string;
    calls: StarknetTraceCall[];
};
/**
 * Starknet on-chain event handler for front-end systems without access to fs, uses WS or long-polling to subscribe, might lose
 *  out on some events if the network is unreliable, front-end systems should take this into consideration and not
 *  rely purely on events
 */
export declare class StarknetChainEventsBrowser implements ChainEvents<StarknetSwapData> {
    protected readonly listeners: EventListener<StarknetSwapData>[];
    protected readonly provider: Provider;
    protected readonly starknetSwapContract: StarknetSwapContract;
    protected readonly starknetSpvVaultContract: StarknetSpvVaultContract;
    protected readonly logger: import("../../utils/Utils").LoggerType;
    protected initFunctionName: ExtractAbiFunctionNames<EscrowManagerAbiType>;
    protected initEntryPointSelector: bigint;
    protected stopped: boolean;
    protected pollIntervalSeconds: number;
    private timeout;
    constructor(chainInterface: StarknetChainInterface, starknetSwapContract: StarknetSwapContract, starknetSpvVaultContract: StarknetSpvVaultContract, pollIntervalSeconds?: number);
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
    protected parseSpvOpenEvent(event: StarknetAbiEvent<SpvVaultContractAbiType, "spv_swap_vault::events::Opened">): SpvVaultOpenEvent;
    protected parseSpvDepositEvent(event: StarknetAbiEvent<SpvVaultContractAbiType, "spv_swap_vault::events::Deposited">): SpvVaultDepositEvent;
    protected parseSpvFrontEvent(event: StarknetAbiEvent<SpvVaultContractAbiType, "spv_swap_vault::events::Fronted">): SpvVaultFrontEvent;
    protected parseSpvClaimEvent(event: StarknetAbiEvent<SpvVaultContractAbiType, "spv_swap_vault::events::Claimed">): SpvVaultClaimEvent;
    protected parseSpvCloseEvent(event: StarknetAbiEvent<SpvVaultContractAbiType, "spv_swap_vault::events::Closed">): SpvVaultCloseEvent;
    /**
     * Processes event as received from the chain, parses it & calls event listeners
     *
     * @param events
     * @param currentBlockNumber
     * @param currentBlockTimestamp
     * @protected
     */
    protected processEvents(events: (StarknetAbiEvent<EscrowManagerAbiType, "escrow_manager::events::Initialize" | "escrow_manager::events::Refund" | "escrow_manager::events::Claim"> | StarknetAbiEvent<SpvVaultContractAbiType, "spv_swap_vault::events::Opened" | "spv_swap_vault::events::Deposited" | "spv_swap_vault::events::Fronted" | "spv_swap_vault::events::Claimed" | "spv_swap_vault::events::Closed">)[], currentBlockNumber: number, currentBlockTimestamp: number): Promise<void>;
    protected checkEventsEcrowManager(lastTxHash: string, lastBlockNumber?: number, currentBlock?: {
        timestamp: number;
        block_number: number;
    }): Promise<string>;
    protected checkEventsSpvVaults(lastTxHash: string, lastBlockNumber?: number, currentBlock?: {
        timestamp: number;
        block_number: number;
    }): Promise<string>;
    protected checkEvents(lastBlockNumber: number, lastTxHashes: string[]): Promise<{
        txHashes: string[];
        blockNumber: number;
    }>;
    /**
     * Sets up event handlers listening for swap events over websocket
     *
     * @protected
     */
    protected setupPoll(lastBlockNumber?: number, lastTxHashes?: string[], saveLatestProcessedBlockNumber?: (blockNumber: number, lastTxHashes: string[]) => Promise<void>): Promise<void>;
    init(): Promise<void>;
    stop(): Promise<void>;
    registerListener(cbk: EventListener<StarknetSwapData>): void;
    unregisterListener(cbk: EventListener<StarknetSwapData>): boolean;
}
