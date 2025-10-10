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
    parseInitFunctionCalldata, toBigInt,
    toHex
} from "../../utils/Utils";
import {StarknetSwapContract} from "../swaps/StarknetSwapContract";
import {BigNumberish, BlockTag, hash, Provider} from "starknet";
import {StarknetAbiEvent} from "../contract/modules/StarknetContractEvents";
import {EscrowManagerAbiType} from "../swaps/EscrowManagerAbi";
import {ExtractAbiFunctionNames} from "abi-wan-kanabi/dist/kanabi";
import {IClaimHandler} from "../swaps/handlers/claim/ClaimHandlers";
import {StarknetSpvVaultContract} from "../spv_swap/StarknetSpvVaultContract";
import {StarknetChainInterface} from "../chain/StarknetChainInterface";
import {SpvVaultContractAbiType} from "../spv_swap/SpvVaultContractAbi";

export type StarknetTraceCall = {
    calldata: string[],
    contract_address: string,
    entry_point_selector: string,
    calls: StarknetTraceCall[]
};

/**
 * Starknet on-chain event handler for front-end systems without access to fs, uses WS or long-polling to subscribe, might lose
 *  out on some events if the network is unreliable, front-end systems should take this into consideration and not
 *  rely purely on events
 */
export class StarknetChainEventsBrowser implements ChainEvents<StarknetSwapData> {

    protected readonly listeners: EventListener<StarknetSwapData>[] = [];
    protected readonly provider: Provider;
    protected readonly starknetSwapContract: StarknetSwapContract;
    protected readonly starknetSpvVaultContract: StarknetSpvVaultContract;
    protected readonly logger = getLogger("StarknetChainEventsBrowser: ");

    protected initFunctionName: ExtractAbiFunctionNames<EscrowManagerAbiType> = "initialize";
    protected initEntryPointSelector = BigInt(hash.starknetKeccak(this.initFunctionName));

    protected stopped: boolean;
    protected pollIntervalSeconds: number;

    private timeout: any;

    constructor(
        chainInterface: StarknetChainInterface,
        starknetSwapContract: StarknetSwapContract,
        starknetSpvVaultContract: StarknetSpvVaultContract,
        pollIntervalSeconds: number = 5
    ) {
        this.provider = chainInterface.provider;
        this.starknetSwapContract = starknetSwapContract;
        this.starknetSpvVaultContract = starknetSpvVaultContract;
        this.pollIntervalSeconds = pollIntervalSeconds;
    }

    findInitSwapData(call: StarknetTraceCall, escrowHash: BigNumberish, claimHandler: IClaimHandler<any, any>): StarknetSwapData {
        if(
            BigInt(call.contract_address)===BigInt(this.starknetSwapContract.contract.address) &&
            BigInt(call.entry_point_selector)===this.initEntryPointSelector
        ) {
            //Found, check correct escrow hash
            const {escrow, extraData} = parseInitFunctionCalldata(call.calldata, claimHandler);
            if("0x"+escrow.getEscrowHash()===toHex(escrowHash)) {
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
            let trace: any;
            try {
                trace = await this.provider.getTransactionTrace(event.txHash);
            } catch (e) {
                this.logger.warn("getSwapDataGetter(): getter: starknet_traceTransaction not supported by the RPC: ", e);
                const blockTraces: any[] = await this.provider.getBlockTransactionsTraces(event.blockHash);
                const foundTrace = blockTraces.find(val => toHex(val.transaction_hash)===toHex(event.txHash));
                if(foundTrace==null) throw new Error(`Cannot find ${event.txHash} in the block traces, block: ${event.blockHash}`);
                trace = foundTrace.trace_root;
            }
            if(trace==null) return null;
            if(trace.execute_invocation.revert_reason!=null) return null;
            return this.findInitSwapData(trace.execute_invocation as any, event.params.escrow_hash, claimHandler);
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

    protected parseSpvOpenEvent(
        event: StarknetAbiEvent<SpvVaultContractAbiType, "spv_swap_vault::events::Opened">
    ): SpvVaultOpenEvent {
        const owner = toHex(event.params.owner);
        const vaultId = toBigInt(event.params.vault_id);
        const btcTxId = bigNumberishToBuffer(event.params.btc_tx_hash, 32).reverse().toString("hex");
        const vout = Number(toBigInt(event.params.vout));

        this.logger.debug("SpvOpenEvent owner: "+owner+" vaultId: "+vaultId+" utxo: "+btcTxId+":"+vout);
        return new SpvVaultOpenEvent(owner, vaultId, btcTxId, vout);
    }

    protected parseSpvDepositEvent(
        event: StarknetAbiEvent<SpvVaultContractAbiType, "spv_swap_vault::events::Deposited">
    ): SpvVaultDepositEvent {
        const owner = toHex(event.params.owner);
        const vaultId = toBigInt(event.params.vault_id);
        const amounts = [toBigInt(event.params.amounts["0"] as BigNumberish), toBigInt(event.params.amounts["1"] as BigNumberish)];
        const depositCount = Number(toBigInt(event.params.deposit_count));

        this.logger.debug("SpvDepositEvent owner: "+owner+" vaultId: "+vaultId+" depositCount: "+depositCount+" amounts: ", amounts);
        return new SpvVaultDepositEvent(owner, vaultId, amounts, depositCount);
    }

    protected parseSpvFrontEvent(
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

    protected parseSpvClaimEvent(
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

    protected parseSpvCloseEvent(
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
     * @protected
     */
    protected async processEvents(
        events : (StarknetAbiEvent<
            EscrowManagerAbiType,
            "escrow_manager::events::Initialize" | "escrow_manager::events::Refund" | "escrow_manager::events::Claim"
        > | StarknetAbiEvent<
            SpvVaultContractAbiType,
            "spv_swap_vault::events::Opened" | "spv_swap_vault::events::Deposited" | "spv_swap_vault::events::Fronted" | "spv_swap_vault::events::Claimed" | "spv_swap_vault::events::Closed"
        >)[],
        currentBlockNumber: number,
        currentBlockTimestamp: number
    ) {
        const blockTimestampsCache: {[blockNumber: string]: number} = {};
        const getBlockTimestamp: (blockNumber: number) => Promise<number> = async (blockNumber: number)=> {
            if(blockNumber===currentBlockNumber) return currentBlockTimestamp;
            const blockNumberString = blockNumber.toString();
            blockTimestampsCache[blockNumberString] ??= (await this.provider.getBlockWithTxHashes(blockNumber)).timestamp;
            return blockTimestampsCache[blockNumberString];
        }

        const parsedEvents: ChainEvent<StarknetSwapData>[] = [];

        for(let event of events) {
            let parsedEvent: ChainEvent<StarknetSwapData>;
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
            if(parsedEvent==null) continue;
            //We are not trusting pre-confs for events, so this shall never happen
            if(event.blockNumber==null) throw new Error("Event block number cannot be null!");
            const timestamp = await getBlockTimestamp(event.blockNumber);
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

    protected async checkEventsEcrowManager(lastTxHash: string, lastBlockNumber?: number, currentBlock?: {timestamp: number, block_number: number}): Promise<string> {
        const currentBlockNumber: number = (currentBlock as any).block_number;
        lastBlockNumber ??= currentBlockNumber;
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
                // this.logger.debug("checkEvents(EscrowManager): Splicing processed events, resulting size: "+events.length);
            }
        }
        if(events.length>0) {
            await this.processEvents(events, currentBlock?.block_number, currentBlock?.timestamp);
            lastTxHash = events[events.length-1].txHash;
        }
        return lastTxHash;
    }

    protected async checkEventsSpvVaults(lastTxHash: string, lastBlockNumber?: number, currentBlock?: {timestamp: number, block_number: number}): Promise<string> {
        const currentBlockNumber: number = (currentBlock as any).block_number;
        lastBlockNumber ??= currentBlockNumber;
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
                // this.logger.debug("checkEvents(SpvVaults): Splicing processed events, resulting size: "+events.length);
            }
        }
        if(events.length>0) {
            await this.processEvents(events, currentBlock?.block_number, currentBlock?.timestamp);
            lastTxHash = events[events.length-1].txHash;
        }
        return lastTxHash;
    }

    protected async checkEvents(lastBlockNumber: number, lastTxHashes: string[]): Promise<{txHashes: string[], blockNumber: number}> {
        lastTxHashes ??= [];

        const currentBlock = await this.provider.getBlockWithTxHashes(BlockTag.LATEST);
        const currentBlockNumber: number = currentBlock.block_number;

        lastTxHashes[0] = await this.checkEventsEcrowManager(lastTxHashes[0], lastBlockNumber, currentBlock as any);
        lastTxHashes[1] = await this.checkEventsSpvVaults(lastTxHashes[1], lastBlockNumber, currentBlock as any);

        return {
            txHashes: lastTxHashes,
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
        lastTxHashes?: string[],
        saveLatestProcessedBlockNumber?: (blockNumber: number, lastTxHashes: string[]) => Promise<void>
    ) {
        this.stopped = false;
        let func;
        func = async () => {
            await this.checkEvents(lastBlockNumber, lastTxHashes).then(({blockNumber, txHashes}) => {
                lastBlockNumber = blockNumber;
                lastTxHashes = txHashes;
                if(saveLatestProcessedBlockNumber!=null) return saveLatestProcessedBlockNumber(blockNumber, lastTxHashes);
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
