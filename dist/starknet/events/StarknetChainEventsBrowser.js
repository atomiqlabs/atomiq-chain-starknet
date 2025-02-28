"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetChainEventsBrowser = void 0;
const base_1 = require("@atomiqlabs/base");
const Utils_1 = require("../../utils/Utils");
const starknet_1 = require("starknet");
/**
 * Solana on-chain event handler for front-end systems without access to fs, uses pure WS to subscribe, might lose
 *  out on some events if the network is unreliable, front-end systems should take this into consideration and not
 *  rely purely on events
 */
class StarknetChainEventsBrowser {
    constructor(starknetSwapContract, pollIntervalSeconds = 5) {
        this.listeners = [];
        this.eventListeners = [];
        this.logger = (0, Utils_1.getLogger)("StarknetChainEventsBrowser: ");
        this.initFunctionName = "initialize";
        this.initEntryPointSelector = BigInt(starknet_1.hash.starknetKeccak(this.initFunctionName));
        this.provider = starknetSwapContract.provider;
        this.starknetSwapContract = starknetSwapContract;
        this.pollIntervalSeconds = pollIntervalSeconds;
    }
    findInitSwapData(call, escrowHash, claimHandler) {
        if (BigInt(call.contract_address) === BigInt(this.starknetSwapContract.contract.address) &&
            BigInt(call.entry_point_selector) === this.initEntryPointSelector) {
            //Found, check correct escrow hash
            const { escrow, extraData } = (0, Utils_1.parseInitFunctionCalldata)(call.calldata, claimHandler);
            if ("0x" + escrow.getEscrowHash() === (0, Utils_1.toHex)(escrowHash)) {
                if (extraData.length !== 0) {
                    escrow.setExtraData((0, Utils_1.bytes31SpanToBuffer)(extraData, 42).toString("hex"));
                }
                return escrow;
            }
        }
        for (let _call of call.calls) {
            const found = this.findInitSwapData(_call, escrowHash, claimHandler);
            if (found != null)
                return found;
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
    getSwapDataGetter(event, claimHandler) {
        return async () => {
            const trace = await this.provider.getTransactionTrace(event.txHash);
            if (trace == null)
                return null;
            if (trace.execute_invocation.revert_reason != null)
                return null;
            return this.findInitSwapData(trace.execute_invocation, event.params.escrow_hash, claimHandler);
        };
    }
    parseInitializeEvent(event) {
        const escrowHashBuffer = (0, Utils_1.bigNumberishToBuffer)(event.params.escrow_hash, 32);
        const escrowHash = escrowHashBuffer.toString("hex");
        const claimHandlerHex = (0, Utils_1.toHex)(event.params.claim_handler);
        const claimHandler = this.starknetSwapContract.claimHandlersByAddress[claimHandlerHex];
        if (claimHandler == null) {
            this.logger.warn("parseInitializeEvent(" + escrowHash + "): Unknown claim handler with claim: " + claimHandlerHex);
            return null;
        }
        const swapType = claimHandler.getType();
        this.logger.debug("InitializeEvent claimHash: " + (0, Utils_1.toHex)(event.params.claim_data) + " escrowHash: " + escrowHash);
        return new base_1.InitializeEvent(escrowHash, swapType, (0, Utils_1.onceAsync)(this.getSwapDataGetter(event, claimHandler)));
    }
    parseRefundEvent(event) {
        const escrowHashBuffer = (0, Utils_1.bigNumberishToBuffer)(event.params.escrow_hash, 32);
        const escrowHash = escrowHashBuffer.toString("hex");
        this.logger.debug("RefundEvent claimHash: " + (0, Utils_1.toHex)(event.params.claim_data) + " escrowHash: " + escrowHash);
        return new base_1.RefundEvent(escrowHash);
    }
    parseClaimEvent(event) {
        const escrowHashBuffer = (0, Utils_1.bigNumberishToBuffer)(event.params.escrow_hash, 32);
        const escrowHash = escrowHashBuffer.toString("hex");
        const claimHandlerHex = (0, Utils_1.toHex)(event.params.claim_handler);
        const claimHandler = this.starknetSwapContract.claimHandlersByAddress[claimHandlerHex];
        if (claimHandler == null) {
            this.logger.warn("parseClaimEvent(" + escrowHash + "): Unknown claim handler with claim: " + claimHandlerHex);
            return null;
        }
        const witnessResult = claimHandler.parseWitnessResult(event.params.witness_result);
        this.logger.debug("ClaimEvent claimHash: " + (0, Utils_1.toHex)(event.params.claim_data) +
            " witnessResult: " + witnessResult + " escrowHash: " + escrowHash);
        return new base_1.ClaimEvent(escrowHash, witnessResult);
    }
    /**
     * Processes event as received from the chain, parses it & calls event listeners
     *
     * @param events
     * @param currentBlockNumber
     * @param currentBlockTimestamp
     * @protected
     */
    async processEvents(events, currentBlockNumber, currentBlockTimestamp) {
        const blockTimestampsCache = {};
        const getBlockTimestamp = async (blockNumber) => {
            const blockNumberString = blockNumber.toString();
            blockTimestampsCache[blockNumberString] ?? (blockTimestampsCache[blockNumberString] = (await this.provider.getBlockWithTxHashes(blockNumber)).timestamp);
            return blockTimestampsCache[blockNumberString];
        };
        const parsedEvents = [];
        for (let event of events) {
            let parsedEvent;
            switch (event.name) {
                case "escrow_manager::events::Claim":
                    parsedEvent = this.parseClaimEvent(event);
                    break;
                case "escrow_manager::events::Refund":
                    parsedEvent = this.parseRefundEvent(event);
                    break;
                case "escrow_manager::events::Initialize":
                    parsedEvent = this.parseInitializeEvent(event);
                    break;
            }
            const timestamp = (event.blockNumber == null || event.blockNumber === currentBlockNumber) ? currentBlockTimestamp : await getBlockTimestamp(event.blockNumber);
            parsedEvent.meta = {
                blockTime: timestamp,
                txId: event.txHash,
                timestamp //Maybe deprecated
            };
            parsedEvents.push(parsedEvent);
        }
        for (let listener of this.listeners) {
            await listener(parsedEvents);
        }
    }
    async checkEvents(lastBlockNumber, lastTxHash) {
        //Get pending events
        let pendingEvents = await this.starknetSwapContract.Events.getContractBlockEvents(["escrow_manager::events::Initialize", "escrow_manager::events::Claim", "escrow_manager::events::Refund"], []);
        if (lastTxHash != null) {
            const latestProcessedEventIndex = (0, Utils_1.findLastIndex)(pendingEvents, val => val.txHash === lastTxHash);
            if (latestProcessedEventIndex !== -1)
                pendingEvents.splice(0, latestProcessedEventIndex + 1);
        }
        if (pendingEvents.length > 0) {
            await this.processEvents(pendingEvents, null, Math.floor(Date.now() / 1000));
            lastTxHash = pendingEvents[pendingEvents.length - 1].txHash;
        }
        const currentBlock = await this.provider.getBlockWithTxHashes("latest");
        const currentBlockNumber = currentBlock.block_number;
        if (lastBlockNumber != null && currentBlockNumber > lastBlockNumber) {
            const events = await this.starknetSwapContract.Events.getContractBlockEvents(["escrow_manager::events::Initialize", "escrow_manager::events::Claim", "escrow_manager::events::Refund"], [], lastBlockNumber + 1, currentBlockNumber);
            if (lastTxHash != null) {
                const latestProcessedEventIndex = (0, Utils_1.findLastIndex)(events, val => val.txHash === lastTxHash);
                if (latestProcessedEventIndex !== -1)
                    events.splice(0, latestProcessedEventIndex + 1);
            }
            if (events.length > 0) {
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
    async setupPoll(lastBlockNumber, lastTxHash, saveLatestProcessedBlockNumber) {
        this.stopped = false;
        let func;
        func = async () => {
            await this.checkEvents(lastBlockNumber, lastTxHash).then(({ blockNumber, txHash }) => {
                lastBlockNumber = blockNumber;
                lastTxHash = txHash;
                if (saveLatestProcessedBlockNumber != null)
                    return saveLatestProcessedBlockNumber(blockNumber, lastTxHash);
            }).catch(e => {
                this.logger.error("setupPoll(): Failed to fetch starknet log: ", e);
            });
            if (this.stopped)
                return;
            this.timeout = setTimeout(func, this.pollIntervalSeconds * 1000);
        };
        await func();
    }
    init() {
        this.setupPoll();
        return Promise.resolve();
    }
    async stop() {
        this.stopped = true;
        if (this.timeout != null)
            clearTimeout(this.timeout);
        this.eventListeners = [];
    }
    registerListener(cbk) {
        this.listeners.push(cbk);
    }
    unregisterListener(cbk) {
        const index = this.listeners.indexOf(cbk);
        if (index >= 0) {
            this.listeners.splice(index, 1);
            return true;
        }
        return false;
    }
}
exports.StarknetChainEventsBrowser = StarknetChainEventsBrowser;
