"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
        this.initEntryPointSelector = (0, Utils_1.toHex)(starknet_1.hash.starknetKeccak(this.initFunctionName));
        this.provider = starknetSwapContract.provider;
        this.starknetSwapContract = starknetSwapContract;
        this.pollIntervalSeconds = pollIntervalSeconds;
    }
    findInitSwapData(call, escrowHash, claimHandler) {
        if (call.contract_address === this.starknetSwapContract.contract.address &&
            call.entry_point_selector === this.initEntryPointSelector) {
            //Found, check correct escrow hash
            const { escrow, extraData } = (0, Utils_1.parseInitFunctionCalldata)(call.calldata, claimHandler);
            if ((0, Utils_1.toHex)(escrow.getEscrowHash()) === (0, Utils_1.toHex)(escrowHash)) {
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
        return () => __awaiter(this, void 0, void 0, function* () {
            const trace = yield this.provider.getTransactionTrace(event.txHash);
            if (trace.invoke_tx_trace == null)
                return null;
            if (trace.invoke_tx_trace.execute_invocation.revert_reason != null)
                return null;
            return this.findInitSwapData(trace.invoke_tx_trace.execute_invocation, event.params.escrow_hash, claimHandler);
        });
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
    processEvents(events, currentBlockNumber, currentBlockTimestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            const blockTimestampsCache = {};
            const getBlockTimestamp = (blockNumber) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const blockNumberString = blockNumber.toString();
                (_a = blockTimestampsCache[blockNumberString]) !== null && _a !== void 0 ? _a : (blockTimestampsCache[blockNumberString] = (yield this.provider.getBlockWithTxHashes(blockNumber)).timestamp);
                return blockTimestampsCache[blockNumberString];
            });
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
                const timestamp = (event.blockNumber == null || event.blockNumber === currentBlockNumber) ? currentBlockTimestamp : yield getBlockTimestamp(event.blockNumber);
                parsedEvent.meta = {
                    blockTime: timestamp,
                    txId: event.txHash,
                    timestamp //Maybe deprecated
                };
                parsedEvents.push(parsedEvent);
            }
            for (let listener of this.listeners) {
                yield listener(parsedEvents);
            }
        });
    }
    checkEvents(lastBlockNumber, lastTxHash) {
        return __awaiter(this, void 0, void 0, function* () {
            //Get pending events
            let pendingEvents = yield this.starknetSwapContract.Events.getContractBlockEvents(["escrow_manager::events::Initialize", "escrow_manager::events::Claim", "escrow_manager::events::Refund"], []);
            if (lastTxHash != null) {
                const latestProcessedEventIndex = (0, Utils_1.findLastIndex)(pendingEvents, val => val.txHash === lastTxHash);
                if (latestProcessedEventIndex !== -1)
                    pendingEvents.splice(0, latestProcessedEventIndex + 1);
            }
            yield this.processEvents(pendingEvents, null, Math.floor(Date.now() / 1000));
            lastTxHash = pendingEvents[pendingEvents.length - 1].txHash;
            const currentBlock = yield this.provider.getBlockWithTxHashes("latest");
            const currentBlockNumber = currentBlock.block_number;
            if (lastBlockNumber != null && currentBlockNumber > lastBlockNumber) {
                const events = yield this.starknetSwapContract.Events.getContractBlockEvents(["escrow_manager::events::Initialize", "escrow_manager::events::Claim", "escrow_manager::events::Refund"], [], lastBlockNumber + 1, currentBlockNumber);
                if (lastTxHash != null) {
                    const latestProcessedEventIndex = (0, Utils_1.findLastIndex)(events, val => val.txHash === lastTxHash);
                    if (latestProcessedEventIndex !== -1)
                        events.splice(0, latestProcessedEventIndex + 1);
                }
                yield this.processEvents(events, currentBlockNumber, currentBlock.timestamp);
                lastTxHash = events[events.length - 1].txHash;
            }
            return {
                txHash: lastTxHash,
                blockNumber: currentBlockNumber
            };
        });
    }
    /**
     * Sets up event handlers listening for swap events over websocket
     *
     * @protected
     */
    setupPoll(lastBlockNumber, lastTxHash, saveLatestProcessedBlockNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            this.stopped = false;
            let func;
            func = () => __awaiter(this, void 0, void 0, function* () {
                yield this.checkEvents(lastBlockNumber, lastTxHash).then(({ blockNumber, txHash }) => {
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
            });
            yield func();
        });
    }
    init() {
        this.setupPoll();
        return Promise.resolve();
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            this.stopped = true;
            if (this.timeout != null)
                clearTimeout(this.timeout);
            this.eventListeners = [];
        });
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
