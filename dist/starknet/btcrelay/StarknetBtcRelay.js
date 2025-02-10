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
exports.StarknetBtcRelay = void 0;
const BN = require("bn.js");
const buffer_1 = require("buffer");
const StarknetBtcHeader_1 = require("./headers/StarknetBtcHeader");
const base_1 = require("@atomiqlabs/base");
const Utils_1 = require("../../utils/Utils");
const StarknetContractBase_1 = require("../contract/StarknetContractBase");
const StarknetBtcStoredHeader_1 = require("./headers/StarknetBtcStoredHeader");
const BtcRelayAbi_1 = require("./BtcRelayAbi");
const starknet_1 = require("starknet");
const StarknetFees_1 = require("../base/modules/StarknetFees");
const StarknetAction_1 = require("../base/StarknetAction");
const randomBytes = require("randombytes");
function serializeBlockHeader(e) {
    return new StarknetBtcHeader_1.StarknetBtcHeader({
        reversed_version: (0, Utils_1.u32ReverseEndianness)(e.getVersion()),
        previous_blockhash: (0, Utils_1.bufferToU32Array)(buffer_1.Buffer.from(e.getPrevBlockhash(), "hex").reverse()),
        merkle_root: (0, Utils_1.bufferToU32Array)(buffer_1.Buffer.from(e.getMerkleRoot(), "hex").reverse()),
        reversed_timestamp: (0, Utils_1.u32ReverseEndianness)(e.getTimestamp()),
        nbits: (0, Utils_1.u32ReverseEndianness)(e.getNbits()),
        nonce: (0, Utils_1.u32ReverseEndianness)(e.getNonce()),
        hash: buffer_1.Buffer.from(e.getHash(), "hex").reverse()
    });
}
const GAS_PER_BLOCKHEADER = 750;
const GAS_PER_BLOCKHEADER_FORK = 750;
const btcRelayAddreses = {
    [starknet_1.constants.StarknetChainId.SN_SEPOLIA]: "0x03e0a5aaca6e679e701c9cd68f3447115b00ec749f4d040488d5ba14101bc86e",
    [starknet_1.constants.StarknetChainId.SN_MAIN]: ""
};
class StarknetBtcRelay extends StarknetContractBase_1.StarknetContractBase {
    SaveMainHeaders(signer, mainHeaders, storedHeader) {
        return new StarknetAction_1.StarknetAction(signer, this, this.contract.populateTransaction.submit_main_blockheaders(mainHeaders, storedHeader), { l1: GAS_PER_BLOCKHEADER * mainHeaders.length, l2: 0 });
    }
    SaveShortForkHeaders(signer, forkHeaders, storedHeader) {
        return new StarknetAction_1.StarknetAction(signer, this, this.contract.populateTransaction.submit_short_fork_blockheaders(forkHeaders, storedHeader), { l1: GAS_PER_BLOCKHEADER * forkHeaders.length, l2: 0 });
    }
    SaveLongForkHeaders(signer, forkId, forkHeaders, storedHeader, totalForkHeaders = 100) {
        return new StarknetAction_1.StarknetAction(signer, this, this.contract.populateTransaction.submit_fork_blockheaders(forkId, forkHeaders, storedHeader), { l1: (GAS_PER_BLOCKHEADER * forkHeaders.length) + (GAS_PER_BLOCKHEADER_FORK * totalForkHeaders), l2: 0 });
    }
    constructor(chainId, provider, bitcoinRpc, contractAddress = btcRelayAddreses[chainId], retryPolicy, solanaFeeEstimator = new StarknetFees_1.StarknetFees(provider)) {
        super(chainId, provider, contractAddress, BtcRelayAbi_1.BtcRelayAbi, retryPolicy, solanaFeeEstimator);
        this.maxHeadersPerTx = 25;
        this.maxForkHeadersPerTx = 25;
        this.maxShortForkHeadersPerTx = 25;
        this.bitcoinRpc = bitcoinRpc;
    }
    /**
     * Computes subsequent commited headers as they will appear on the blockchain when transactions
     *  are submitted & confirmed
     *
     * @param initialStoredHeader
     * @param syncedHeaders
     * @private
     */
    computeCommitedHeaders(initialStoredHeader, syncedHeaders) {
        const computedCommitedHeaders = [initialStoredHeader];
        for (let blockHeader of syncedHeaders) {
            computedCommitedHeaders.push(computedCommitedHeaders[computedCommitedHeaders.length - 1].computeNext(blockHeader));
        }
        return computedCommitedHeaders;
    }
    /**
     * A common logic for submitting blockheaders in a transaction
     *
     * @param signer
     * @param headers headers to sync to the btc relay
     * @param storedHeader current latest stored block header for a given fork
     * @param tipWork work of the current tip in a given fork
     * @param forkId forkId to submit to, forkId=0 means main chain, forkId=-1 means short fork
     * @param feeRate feeRate for the transaction
     * @private
     */
    _saveHeaders(signer, headers, storedHeader, tipWork, forkId, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            const blockHeaderObj = headers.map(serializeBlockHeader);
            let starknetAction;
            switch (forkId) {
                case -1:
                    starknetAction = this.SaveShortForkHeaders(signer, blockHeaderObj, storedHeader);
                    break;
                case 0:
                    starknetAction = this.SaveMainHeaders(signer, blockHeaderObj, storedHeader);
                    break;
                default:
                    starknetAction = this.SaveLongForkHeaders(signer, forkId, blockHeaderObj, storedHeader);
                    break;
            }
            const tx = yield starknetAction.tx(feeRate);
            const computedCommitedHeaders = this.computeCommitedHeaders(storedHeader, blockHeaderObj);
            const lastStoredHeader = computedCommitedHeaders[computedCommitedHeaders.length - 1];
            if (forkId !== 0 && base_1.StatePredictorUtils.gtBuffer(lastStoredHeader.getBlockHash(), tipWork)) {
                //Fork's work is higher than main chain's work, this fork will become a main chain
                forkId = 0;
            }
            return {
                forkId: forkId,
                lastStoredHeader,
                tx,
                computedCommitedHeaders
            };
        });
    }
    getBlock(commitHash, blockHash) {
        const keys = [commitHash == null ? null : (0, Utils_1.toHex)(commitHash)];
        if (blockHash != null) {
            const starknetBlockHash = starknet_1.hash.computePoseidonHashOnElements((0, Utils_1.bufferToU32Array)(buffer_1.Buffer.from([...blockHash]).reverse()));
            keys.push(starknetBlockHash);
        }
        return this.Events.findInContractEvents(["btc_relay::events::StoreHeader", "btc_relay::events::StoreForkHeader"], keys, (event) => {
            return Promise.resolve([new StarknetBtcStoredHeader_1.StarknetBtcStoredHeader(event.params.header), BigInt(event.params.commit_hash)]);
        });
    }
    getBlockHeight() {
        return __awaiter(this, void 0, void 0, function* () {
            return Number(yield this.contract.get_blockheight());
        });
    }
    /**
     * Returns data about current main chain tip stored in the btc relay
     */
    getTipData() {
        return __awaiter(this, void 0, void 0, function* () {
            const commitHash = yield this.contract.get_tip_commit_hash();
            if (commitHash == null || BigInt(commitHash) === BigInt(0))
                return null;
            const result = yield this.getBlock(commitHash);
            if (result == null)
                return null;
            const [storedBlockHeader] = result;
            return {
                blockheight: storedBlockHeader.getBlockheight(),
                commitHash: (0, Utils_1.bigNumberishToBuffer)(commitHash, 32).toString("hex"),
                blockhash: storedBlockHeader.getBlockHash().toString("hex"),
                chainWork: storedBlockHeader.getChainWork()
            };
        });
    }
    /**
     * Retrieves blockheader with a specific blockhash, returns null if requiredBlockheight is provided and
     *  btc relay contract is not synced up to the desired blockheight
     *
     * @param blockData
     * @param requiredBlockheight
     */
    retrieveLogAndBlockheight(blockData, requiredBlockheight) {
        return __awaiter(this, void 0, void 0, function* () {
            //TODO: we can fetch the blockheight and events in parallel
            const blockHeight = yield this.getBlockHeight();
            if (requiredBlockheight != null && blockHeight < requiredBlockheight) {
                return null;
            }
            const result = yield this.getBlock(null, buffer_1.Buffer.from(blockData.blockhash, "hex"));
            if (result == null)
                return null;
            const [storedBlockHeader, commitHash] = result;
            //Check if block is part of the main chain
            const chainCommitment = yield this.contract.get_commit_hash(storedBlockHeader.block_height);
            if (BigInt(chainCommitment) !== BigInt(commitHash))
                return null;
            this.logger.debug("retrieveLogAndBlockheight(): block found," +
                " commit hash: " + (0, Utils_1.toHex)(commitHash) + " blockhash: " + blockData.blockhash + " current btc relay height: " + blockHeight);
            return { header: storedBlockHeader, height: blockHeight };
        });
    }
    /**
     * Retrieves blockheader data by blockheader's commit hash,
     *
     * @param commitmentHashStr
     * @param blockData
     */
    retrieveLogByCommitHash(commitmentHashStr, blockData) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.getBlock(commitmentHashStr, buffer_1.Buffer.from(blockData.blockhash, "hex"));
            if (result == null)
                return null;
            const [storedBlockHeader, commitHash] = result;
            //Check if block is part of the main chain
            const chainCommitment = yield this.contract.get_commit_hash(storedBlockHeader.block_height);
            if (BigInt(chainCommitment) !== BigInt(commitHash))
                return null;
            this.logger.debug("retrieveLogByCommitHash(): block found," +
                " commit hash: " + commitmentHashStr + " blockhash: " + blockData.blockhash + " height: " + storedBlockHeader.block_height);
            return storedBlockHeader;
        });
    }
    /**
     * Retrieves latest known stored blockheader & blockheader from bitcoin RPC that is in the main chain
     */
    retrieveLatestKnownBlockLog() {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield this.Events.findInContractEvents(["btc_relay::events::StoreHeader", "btc_relay::events::StoreForkHeader"], null, (event) => __awaiter(this, void 0, void 0, function* () {
                const storedHeader = new StarknetBtcStoredHeader_1.StarknetBtcStoredHeader(event.params.header);
                const blockHashHex = storedHeader.getBlockHash().toString("hex");
                const commitHash = event.params.commit_hash;
                const [isInBtcMainChain, btcRelayCommitHash] = yield Promise.all([
                    this.bitcoinRpc.isInMainChain(blockHashHex).catch(() => false),
                    this.contract.get_commit_hash(storedHeader.block_height)
                ]);
                if (!isInBtcMainChain)
                    return null;
                if (BigInt(commitHash) !== BigInt(btcRelayCommitHash))
                    return null;
                return {
                    resultStoredHeader: storedHeader,
                    resultBitcoinHeader: yield this.bitcoinRpc.getBlockHeader(blockHashHex),
                    commitHash: commitHash
                };
            }));
            if (data != null)
                this.logger.debug("retrieveLatestKnownBlockLog(): block found," +
                    " commit hash: " + (0, Utils_1.toHex)(data.commitHash) + " blockhash: " + data.resultBitcoinHeader.getHash() +
                    " height: " + data.resultStoredHeader.getBlockheight());
            return data;
        });
    }
    /**
     * Saves blockheaders as a bitcoin main chain to the btc relay
     *
     * @param signer
     * @param mainHeaders
     * @param storedHeader
     * @param feeRate
     */
    saveMainHeaders(signer, mainHeaders, storedHeader, feeRate) {
        this.logger.debug("saveMainHeaders(): submitting main blockheaders, count: " + mainHeaders.length);
        return this._saveHeaders(signer, mainHeaders, storedHeader, null, 0, feeRate);
    }
    /**
     * Creates a new long fork and submits the headers to it
     *
     * @param signer
     * @param forkHeaders
     * @param storedHeader
     * @param tipWork
     * @param feeRate
     */
    saveNewForkHeaders(signer, forkHeaders, storedHeader, tipWork, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            let forkId = new BN(randomBytes(6));
            this.logger.debug("saveNewForkHeaders(): submitting new fork & blockheaders," +
                " count: " + forkHeaders.length + " forkId: 0x" + forkId.toString(16));
            return yield this._saveHeaders(signer, forkHeaders, storedHeader, tipWork, forkId.toNumber(), feeRate);
        });
    }
    /**
     * Continues submitting blockheaders to a given fork
     *
     * @param signer
     * @param forkHeaders
     * @param storedHeader
     * @param forkId
     * @param tipWork
     * @param feeRate
     */
    saveForkHeaders(signer, forkHeaders, storedHeader, forkId, tipWork, feeRate) {
        this.logger.debug("saveForkHeaders(): submitting blockheaders to existing fork," +
            " count: " + forkHeaders.length + " forkId: 0x" + forkId.toString(16));
        return this._saveHeaders(signer, forkHeaders, storedHeader, tipWork, forkId, feeRate);
    }
    /**
     * Submits short fork with given blockheaders
     *
     * @param signer
     * @param forkHeaders
     * @param storedHeader
     * @param tipWork
     * @param feeRate
     */
    saveShortForkHeaders(signer, forkHeaders, storedHeader, tipWork, feeRate) {
        this.logger.debug("saveShortForkHeaders(): submitting short fork blockheaders," +
            " count: " + forkHeaders.length);
        return this._saveHeaders(signer, forkHeaders, storedHeader, tipWork, -1, feeRate);
    }
    /**
     * Estimate required synchronization fee (worst case) to synchronize btc relay to the required blockheight
     *
     * @param requiredBlockheight
     * @param feeRate
     */
    estimateSynchronizeFee(requiredBlockheight, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            const tipData = yield this.getTipData();
            const currBlockheight = tipData.blockheight;
            const blockheightDelta = requiredBlockheight - currBlockheight;
            if (blockheightDelta <= 0)
                return new BN(0);
            const synchronizationFee = new BN(blockheightDelta).mul(yield this.getFeePerBlock(feeRate));
            this.logger.debug("estimateSynchronizeFee(): required blockheight: " + requiredBlockheight +
                " blockheight delta: " + blockheightDelta + " fee: " + synchronizationFee.toString(10));
            return synchronizationFee;
        });
    }
    /**
     * Returns fee required (in SOL) to synchronize a single block to btc relay
     *
     * @param feeRate
     */
    getFeePerBlock(feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            return StarknetFees_1.StarknetFees.getGasFee(GAS_PER_BLOCKHEADER, feeRate);
        });
    }
    /**
     * Gets fee rate required for submitting blockheaders to the main chain
     */
    getMainFeeRate(signer) {
        return this.Fees.getFeeRate();
    }
    /**
     * Gets fee rate required for submitting blockheaders to the specific fork
     */
    getForkFeeRate(signer, forkId) {
        return this.Fees.getFeeRate();
    }
    saveInitialHeader(signer, header, epochStart, pastBlocksTimestamps, feeRate) {
        throw new Error("Not supported, starknet contract is initialized with constructor!");
    }
}
exports.StarknetBtcRelay = StarknetBtcRelay;
