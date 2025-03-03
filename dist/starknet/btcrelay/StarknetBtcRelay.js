"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetBtcRelay = void 0;
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
    [starknet_1.constants.StarknetChainId.SN_SEPOLIA]: "0x032afcea912ba13f6a1878fe38af23eaec3e6b4c7db31a3571550d3cf80d3e31",
    [starknet_1.constants.StarknetChainId.SN_MAIN]: "0x05cc69b09e8c53520f9e328f6eca72cf02fe46ce290b757d42414e2238001603"
};
function serializeCalldata(headers, storedHeader, span) {
    span.push((0, Utils_1.toHex)(headers.length));
    headers.forEach(header => {
        span.push(...header.serialize());
    });
    span.push(...storedHeader.serialize());
    return span;
}
class StarknetBtcRelay extends StarknetContractBase_1.StarknetContractBase {
    SaveMainHeaders(signer, mainHeaders, storedHeader) {
        return new StarknetAction_1.StarknetAction(signer, this, {
            contractAddress: this.contract.address,
            entrypoint: "submit_main_blockheaders",
            calldata: serializeCalldata(mainHeaders, storedHeader, [])
        }, { l1: GAS_PER_BLOCKHEADER * mainHeaders.length, l2: 0 });
    }
    SaveShortForkHeaders(signer, forkHeaders, storedHeader) {
        return new StarknetAction_1.StarknetAction(signer, this, {
            contractAddress: this.contract.address,
            entrypoint: "submit_short_fork_blockheaders",
            calldata: serializeCalldata(forkHeaders, storedHeader, [])
        }, { l1: GAS_PER_BLOCKHEADER * forkHeaders.length, l2: 0 });
    }
    SaveLongForkHeaders(signer, forkId, forkHeaders, storedHeader, totalForkHeaders = 100) {
        return new StarknetAction_1.StarknetAction(signer, this, {
            contractAddress: this.contract.address,
            entrypoint: "submit_fork_blockheaders",
            calldata: serializeCalldata(forkHeaders, storedHeader, [(0, Utils_1.toHex)(forkId)])
        }, { l1: (GAS_PER_BLOCKHEADER * forkHeaders.length) + (GAS_PER_BLOCKHEADER_FORK * totalForkHeaders), l2: 0 });
    }
    constructor(chainId, provider, bitcoinRpc, contractAddress = btcRelayAddreses[chainId], retryPolicy, solanaFeeEstimator = new StarknetFees_1.StarknetFees(provider)) {
        super(chainId, provider, contractAddress, BtcRelayAbi_1.BtcRelayAbi, retryPolicy, solanaFeeEstimator);
        this.maxHeadersPerTx = 100;
        this.maxForkHeadersPerTx = 100;
        this.maxShortForkHeadersPerTx = 100;
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
    async _saveHeaders(signer, headers, storedHeader, tipWork, forkId, feeRate) {
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
        const tx = await starknetAction.tx(feeRate);
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
    }
    getBlock(commitHash, blockHash) {
        const keys = [commitHash == null ? null : (0, Utils_1.toHex)(commitHash)];
        if (blockHash != null) {
            const starknetBlockHash = starknet_1.hash.computePoseidonHashOnElements((0, Utils_1.bufferToU32Array)(buffer_1.Buffer.from([...blockHash]).reverse()));
            keys.push(starknetBlockHash);
        }
        return this.Events.findInContractEvents(["btc_relay::events::StoreHeader", "btc_relay::events::StoreForkHeader"], keys, (event) => {
            return Promise.resolve([StarknetBtcStoredHeader_1.StarknetBtcStoredHeader.fromSerializedFeltArray(event.data), BigInt(event.params.commit_hash)]);
        });
    }
    async getBlockHeight() {
        return Number(await this.contract.get_blockheight());
    }
    /**
     * Returns data about current main chain tip stored in the btc relay
     */
    async getTipData() {
        const commitHash = await this.contract.get_tip_commit_hash();
        if (commitHash == null || BigInt(commitHash) === BigInt(0))
            return null;
        const result = await this.getBlock(commitHash);
        if (result == null)
            return null;
        const [storedBlockHeader] = result;
        return {
            blockheight: storedBlockHeader.getBlockheight(),
            commitHash: (0, Utils_1.bigNumberishToBuffer)(commitHash, 32).toString("hex"),
            blockhash: storedBlockHeader.getBlockHash().toString("hex"),
            chainWork: storedBlockHeader.getChainWork()
        };
    }
    /**
     * Retrieves blockheader with a specific blockhash, returns null if requiredBlockheight is provided and
     *  btc relay contract is not synced up to the desired blockheight
     *
     * @param blockData
     * @param requiredBlockheight
     */
    async retrieveLogAndBlockheight(blockData, requiredBlockheight) {
        //TODO: we can fetch the blockheight and events in parallel
        const blockHeight = await this.getBlockHeight();
        if (requiredBlockheight != null && blockHeight < requiredBlockheight) {
            return null;
        }
        const result = await this.getBlock(null, buffer_1.Buffer.from(blockData.blockhash, "hex"));
        if (result == null)
            return null;
        const [storedBlockHeader, commitHash] = result;
        //Check if block is part of the main chain
        const chainCommitment = await this.contract.get_commit_hash(storedBlockHeader.block_height);
        if (BigInt(chainCommitment) !== BigInt(commitHash))
            return null;
        this.logger.debug("retrieveLogAndBlockheight(): block found," +
            " commit hash: " + (0, Utils_1.toHex)(commitHash) + " blockhash: " + blockData.blockhash + " current btc relay height: " + blockHeight);
        return { header: storedBlockHeader, height: blockHeight };
    }
    /**
     * Retrieves blockheader data by blockheader's commit hash,
     *
     * @param commitmentHashStr
     * @param blockData
     */
    async retrieveLogByCommitHash(commitmentHashStr, blockData) {
        const result = await this.getBlock(commitmentHashStr, buffer_1.Buffer.from(blockData.blockhash, "hex"));
        if (result == null)
            return null;
        const [storedBlockHeader, commitHash] = result;
        //Check if block is part of the main chain
        const chainCommitment = await this.contract.get_commit_hash(storedBlockHeader.block_height);
        if (BigInt(chainCommitment) !== BigInt(commitHash))
            return null;
        this.logger.debug("retrieveLogByCommitHash(): block found," +
            " commit hash: " + commitmentHashStr + " blockhash: " + blockData.blockhash + " height: " + storedBlockHeader.block_height);
        return storedBlockHeader;
    }
    /**
     * Retrieves latest known stored blockheader & blockheader from bitcoin RPC that is in the main chain
     */
    async retrieveLatestKnownBlockLog() {
        const data = await this.Events.findInContractEvents(["btc_relay::events::StoreHeader", "btc_relay::events::StoreForkHeader"], null, async (event) => {
            const storedHeader = StarknetBtcStoredHeader_1.StarknetBtcStoredHeader.fromSerializedFeltArray(event.data);
            const blockHashHex = storedHeader.getBlockHash().toString("hex");
            const commitHash = event.params.commit_hash;
            const [isInBtcMainChain, btcRelayCommitHash] = await Promise.all([
                this.bitcoinRpc.isInMainChain(blockHashHex).catch(() => false),
                this.contract.get_commit_hash(storedHeader.block_height)
            ]);
            if (!isInBtcMainChain)
                return null;
            if (BigInt(commitHash) !== BigInt(btcRelayCommitHash))
                return null;
            return {
                resultStoredHeader: storedHeader,
                resultBitcoinHeader: await this.bitcoinRpc.getBlockHeader(blockHashHex),
                commitHash: commitHash
            };
        });
        if (data != null)
            this.logger.debug("retrieveLatestKnownBlockLog(): block found," +
                " commit hash: " + (0, Utils_1.toHex)(data.commitHash) + " blockhash: " + data.resultBitcoinHeader.getHash() +
                " height: " + data.resultStoredHeader.getBlockheight());
        return data;
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
    async saveNewForkHeaders(signer, forkHeaders, storedHeader, tipWork, feeRate) {
        let forkId = Math.floor(Math.random() * 0xFFFFFFFFFFFF);
        this.logger.debug("saveNewForkHeaders(): submitting new fork & blockheaders," +
            " count: " + forkHeaders.length + " forkId: 0x" + forkId.toString(16));
        return await this._saveHeaders(signer, forkHeaders, storedHeader, tipWork, forkId, feeRate);
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
    async estimateSynchronizeFee(requiredBlockheight, feeRate) {
        const tipData = await this.getTipData();
        const currBlockheight = tipData.blockheight;
        const blockheightDelta = requiredBlockheight - currBlockheight;
        if (blockheightDelta <= 0)
            return 0n;
        const synchronizationFee = BigInt(blockheightDelta) * await this.getFeePerBlock(feeRate);
        this.logger.debug("estimateSynchronizeFee(): required blockheight: " + requiredBlockheight +
            " blockheight delta: " + blockheightDelta + " fee: " + synchronizationFee.toString(10));
        return synchronizationFee;
    }
    /**
     * Returns fee required (in SOL) to synchronize a single block to btc relay
     *
     * @param feeRate
     */
    async getFeePerBlock(feeRate) {
        feeRate ?? (feeRate = await this.Fees.getFeeRate());
        return StarknetFees_1.StarknetFees.getGasFee(GAS_PER_BLOCKHEADER, feeRate);
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
