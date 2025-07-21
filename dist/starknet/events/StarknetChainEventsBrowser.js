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
    constructor(chainInterface, starknetSwapContract, starknetSpvVaultContract, pollIntervalSeconds = 5) {
        this.listeners = [];
        this.eventListeners = [];
        this.logger = (0, Utils_1.getLogger)("StarknetChainEventsBrowser: ");
        this.initFunctionName = "initialize";
        this.initEntryPointSelector = BigInt(starknet_1.hash.starknetKeccak(this.initFunctionName));
        this.provider = chainInterface.provider;
        this.starknetSwapContract = starknetSwapContract;
        this.starknetSpvVaultContract = starknetSpvVaultContract;
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
    parseSpvOpenEvent(event) {
        const owner = (0, Utils_1.toHex)(event.params.owner);
        const vaultId = (0, Utils_1.toBigInt)(event.params.vault_id);
        const btcTxId = (0, Utils_1.bigNumberishToBuffer)(event.params.btc_tx_hash, 32).reverse().toString("hex");
        const vout = Number((0, Utils_1.toBigInt)(event.params.vout));
        this.logger.debug("SpvOpenEvent owner: " + owner + " vaultId: " + vaultId + " utxo: " + btcTxId + ":" + vout);
        return new base_1.SpvVaultOpenEvent(owner, vaultId, btcTxId, vout);
    }
    parseSpvDepositEvent(event) {
        const owner = (0, Utils_1.toHex)(event.params.owner);
        const vaultId = (0, Utils_1.toBigInt)(event.params.vault_id);
        const amounts = [(0, Utils_1.toBigInt)(event.params.amounts["0"]), (0, Utils_1.toBigInt)(event.params.amounts["1"])];
        const depositCount = Number((0, Utils_1.toBigInt)(event.params.deposit_count));
        this.logger.debug("SpvDepositEvent owner: " + owner + " vaultId: " + vaultId + " depositCount: " + depositCount + " amounts: ", amounts);
        return new base_1.SpvVaultDepositEvent(owner, vaultId, amounts, depositCount);
    }
    parseSpvFrontEvent(event) {
        const owner = (0, Utils_1.toHex)(event.params.owner);
        const vaultId = (0, Utils_1.toBigInt)(event.params.vault_id);
        const btcTxId = (0, Utils_1.bigNumberishToBuffer)(event.params.btc_tx_hash, 32).reverse().toString("hex");
        const recipient = (0, Utils_1.toHex)(event.params.recipient);
        const executionHash = (0, Utils_1.toHex)(event.params.execution_hash);
        const amounts = [(0, Utils_1.toBigInt)(event.params.amounts["0"]), (0, Utils_1.toBigInt)(event.params.amounts["1"])];
        const frontingAddress = (0, Utils_1.toHex)(event.params.caller);
        this.logger.debug("SpvFrontEvent owner: " + owner + " vaultId: " + vaultId + " btcTxId: " + btcTxId +
            " recipient: " + recipient + " frontedBy: " + frontingAddress + " amounts: ", amounts);
        return new base_1.SpvVaultFrontEvent(owner, vaultId, btcTxId, recipient, executionHash, amounts, frontingAddress);
    }
    parseSpvClaimEvent(event) {
        const owner = (0, Utils_1.toHex)(event.params.owner);
        const vaultId = (0, Utils_1.toBigInt)(event.params.vault_id);
        const btcTxId = (0, Utils_1.bigNumberishToBuffer)(event.params.btc_tx_hash, 32).reverse().toString("hex");
        const recipient = (0, Utils_1.toHex)(event.params.recipient);
        const executionHash = (0, Utils_1.toHex)(event.params.execution_hash);
        const amounts = [(0, Utils_1.toBigInt)(event.params.amounts["0"]), (0, Utils_1.toBigInt)(event.params.amounts["1"])];
        const caller = (0, Utils_1.toHex)(event.params.caller);
        const frontingAddress = (0, Utils_1.toHex)(event.params.fronting_address);
        const withdrawCount = Number((0, Utils_1.toBigInt)(event.params.withdraw_count));
        this.logger.debug("SpvClaimEvent owner: " + owner + " vaultId: " + vaultId + " btcTxId: " + btcTxId + " withdrawCount: " + withdrawCount +
            " recipient: " + recipient + " frontedBy: " + frontingAddress + " claimedBy: " + caller + " amounts: ", amounts);
        return new base_1.SpvVaultClaimEvent(owner, vaultId, btcTxId, recipient, executionHash, amounts, caller, frontingAddress, withdrawCount);
    }
    parseSpvCloseEvent(event) {
        const owner = (0, Utils_1.toHex)(event.params.owner);
        const vaultId = (0, Utils_1.toBigInt)(event.params.vault_id);
        const btcTxId = (0, Utils_1.bigNumberishToBuffer)(event.params.btc_tx_hash, 32).reverse().toString("hex");
        const error = (0, Utils_1.bigNumberishToBuffer)(event.params.error).toString();
        return new base_1.SpvVaultCloseEvent(owner, vaultId, btcTxId, error);
    }
    /**
     * Processes event as received from the chain, parses it & calls event listeners
     *
     * @param events
     * @param currentBlockNumber
     * @param currentBlockTimestamp
     * @param pendingEventTime
     * @protected
     */
    async processEvents(events, currentBlockNumber, currentBlockTimestamp, pendingEventTime) {
        const blockTimestampsCache = {};
        const getBlockTimestamp = async (blockNumber) => {
            if (blockNumber === currentBlockNumber)
                return currentBlockTimestamp;
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
                case "spv_swap_vault::events::Opened":
                    parsedEvent = this.parseSpvOpenEvent(event);
                    break;
                case "spv_swap_vault::events::Deposited":
                    parsedEvent = this.parseSpvDepositEvent(event);
                    break;
                case "spv_swap_vault::events::Fronted":
                    parsedEvent = this.parseSpvFrontEvent(event);
                    break;
                case "spv_swap_vault::events::Claimed":
                    parsedEvent = this.parseSpvClaimEvent(event);
                    break;
                case "spv_swap_vault::events::Closed":
                    parsedEvent = this.parseSpvCloseEvent(event);
                    break;
            }
            if (parsedEvent == null)
                continue;
            const timestamp = event.blockNumber == null ? pendingEventTime : await getBlockTimestamp(event.blockNumber);
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
    async checkEventsEcrowManager(lastTxHash, lastBlockNumber, currentBlock) {
        const currentBlockNumber = currentBlock.block_number;
        lastBlockNumber ?? (lastBlockNumber = currentBlockNumber);
        // this.logger.debug("checkEvents(EscrowManager): Requesting logs: "+logStartHeight+"...pending");
        let events = await this.starknetSwapContract.Events.getContractBlockEvents(["escrow_manager::events::Initialize", "escrow_manager::events::Claim", "escrow_manager::events::Refund"], [], lastBlockNumber, null);
        if (lastTxHash != null) {
            const latestProcessedEventIndex = (0, Utils_1.findLastIndex)(events, val => val.txHash === lastTxHash);
            if (latestProcessedEventIndex !== -1) {
                events.splice(0, latestProcessedEventIndex + 1);
                // this.logger.debug("checkEvents(EscrowManager): Splicing processed events, resulting size: "+events.length);
            }
        }
        if (events.length > 0) {
            await this.processEvents(events, currentBlock?.block_number, currentBlock?.timestamp, Math.floor(Date.now() / 1000));
            lastTxHash = events[events.length - 1].txHash;
        }
        return lastTxHash;
    }
    async checkEventsSpvVaults(lastTxHash, lastBlockNumber, currentBlock) {
        const currentBlockNumber = currentBlock.block_number;
        lastBlockNumber ?? (lastBlockNumber = currentBlockNumber);
        // this.logger.debug("checkEvents(SpvVaults): Requesting logs: "+logStartHeight+"...pending");
        let events = await this.starknetSpvVaultContract.Events.getContractBlockEvents(["spv_swap_vault::events::Opened", "spv_swap_vault::events::Deposited", "spv_swap_vault::events::Closed", "spv_swap_vault::events::Fronted", "spv_swap_vault::events::Claimed"], [], lastBlockNumber, null);
        if (lastTxHash != null) {
            const latestProcessedEventIndex = (0, Utils_1.findLastIndex)(events, val => val.txHash === lastTxHash);
            if (latestProcessedEventIndex !== -1) {
                events.splice(0, latestProcessedEventIndex + 1);
                // this.logger.debug("checkEvents(SpvVaults): Splicing processed events, resulting size: "+events.length);
            }
        }
        if (events.length > 0) {
            await this.processEvents(events, currentBlock?.block_number, currentBlock?.timestamp, Math.floor(Date.now() / 1000));
            lastTxHash = events[events.length - 1].txHash;
        }
        return lastTxHash;
    }
    async checkEvents(lastBlockNumber, lastTxHashes) {
        lastTxHashes ?? (lastTxHashes = []);
        const currentBlock = await this.provider.getBlockWithTxHashes("latest");
        const currentBlockNumber = currentBlock.block_number;
        lastTxHashes[0] = await this.checkEventsEcrowManager(lastTxHashes[0], lastBlockNumber, currentBlock);
        lastTxHashes[1] = await this.checkEventsSpvVaults(lastTxHashes[1], lastBlockNumber, currentBlock);
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
    async setupPoll(lastBlockNumber, lastTxHashes, saveLatestProcessedBlockNumber) {
        this.stopped = false;
        let func;
        func = async () => {
            await this.checkEvents(lastBlockNumber, lastTxHashes).then(({ blockNumber, txHashes }) => {
                lastBlockNumber = blockNumber;
                lastTxHashes = txHashes;
                if (saveLatestProcessedBlockNumber != null)
                    return saveLatestProcessedBlockNumber(blockNumber, lastTxHashes);
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
