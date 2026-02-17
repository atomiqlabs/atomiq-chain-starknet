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
const StarknetFees_1 = require("../chain/modules/StarknetFees");
const StarknetAction_1 = require("../chain/StarknetAction");
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
const GAS_PER_BLOCKHEADER = { l1DataGas: 600, l2Gas: 24000000, l1Gas: 0 };
const GAS_PER_BLOCKHEADER_FORK = { l1DataGas: 1000, l2Gas: 40000000, l1Gas: 0 };
const btcRelayAddreses = {
    [base_1.BitcoinNetwork.TESTNET4]: "0x0099b63f39f0cabb767361de3d8d3e97212351a51540e2687c2571f4da490dbe",
    [base_1.BitcoinNetwork.TESTNET]: "0x068601c79da2231d21e015ccfd59c243861156fa523a12c9f987ec28eb8dbc8c",
    [base_1.BitcoinNetwork.MAINNET]: "0x057b14a4231b82f1e525ff35a722d893ca3dd2bde0baa6cee97937c5be861dbc"
};
const btcRelayDeploymentHeights = {
    [base_1.BitcoinNetwork.TESTNET4]: 760719,
    [base_1.BitcoinNetwork.TESTNET]: 633915,
    [base_1.BitcoinNetwork.MAINNET]: 1278562
};
function serializeCalldata(headers, storedHeader, span) {
    span.push((0, Utils_1.toHex)(headers.length));
    headers.forEach(header => {
        span.push(...header.serialize());
    });
    span.push(...storedHeader.serialize());
    return span;
}
const logger = (0, Utils_1.getLogger)("StarknetBtcRelay: ");
/**
 * Starknet BTC Relay bitcoin light client contract representation
 *
 * @category BTC Relay
 */
class StarknetBtcRelay extends StarknetContractBase_1.StarknetContractBase {
    /**
     * Returns a {@link StarknetAction} that submits new main chain bitcoin blockheaders to the light client
     *
     * @param signer Starknet signer's address
     * @param mainHeaders New bitcoin blockheaders to submit
     * @param storedHeader Current latest committed and stored bitcoin blockheader in the light client
     */
    SaveMainHeaders(signer, mainHeaders, storedHeader) {
        return new StarknetAction_1.StarknetAction(signer, this.Chain, {
            contractAddress: this.contract.address,
            entrypoint: "submit_main_blockheaders",
            calldata: serializeCalldata(mainHeaders, storedHeader, [])
        }, (0, StarknetFees_1.starknetGasMul)(GAS_PER_BLOCKHEADER, mainHeaders.length));
    }
    /**
     * Returns a {@link StarknetAction} for submitting a short fork bitcoin blockheaders to the light client,
     *  forking the chain from the provided `storedHeader` param's blockheight. For a successful fork the
     *  submitted chain needs to have higher total chainwork than the current cannonical chain
     *
     * @param signer Starknet signer's address
     * @param forkHeaders Fork bitcoin blockheaders to submit
     * @param storedHeader Committed and stored bitcoin blockheader from which to fork the light client
     */
    SaveShortForkHeaders(signer, forkHeaders, storedHeader) {
        return new StarknetAction_1.StarknetAction(signer, this.Chain, {
            contractAddress: this.contract.address,
            entrypoint: "submit_short_fork_blockheaders",
            calldata: serializeCalldata(forkHeaders, storedHeader, [])
        }, (0, StarknetFees_1.starknetGasMul)(GAS_PER_BLOCKHEADER, forkHeaders.length));
    }
    /**
     * Returns a {@link StarknetAction} for submitting a long fork of bitcoin blockheaders to the light client.
     *
     * @param signer Starknet signer's address
     * @param forkId Fork ID to submit the fork blockheaders to
     * @param forkHeaders Fork bitcoin blockheaders to submit
     * @param storedHeader Either a committed and stored bitcoin blockheader from which to fork the light client (when
     *  creating the fork), or the tip of the fork (when adding more blockheaders to the fork)
     * @param totalForkHeaders Total blockheaders in the fork - used to estimate the gas usage when re-org happens
     */
    SaveLongForkHeaders(signer, forkId, forkHeaders, storedHeader, totalForkHeaders = 100) {
        return new StarknetAction_1.StarknetAction(signer, this.Chain, {
            contractAddress: this.contract.address,
            entrypoint: "submit_fork_blockheaders",
            calldata: serializeCalldata(forkHeaders, storedHeader, [(0, Utils_1.toHex)(forkId)])
        }, (0, StarknetFees_1.starknetGasAdd)((0, StarknetFees_1.starknetGasMul)(GAS_PER_BLOCKHEADER, forkHeaders.length), (0, StarknetFees_1.starknetGasMul)(GAS_PER_BLOCKHEADER_FORK, totalForkHeaders)));
    }
    constructor(chainInterface, bitcoinRpc, bitcoinNetwork, contractAddress = btcRelayAddreses[bitcoinNetwork], contractDeploymentHeight) {
        if (contractAddress == null)
            throw new Error("No BtcRelay address specified!");
        super(chainInterface, contractAddress, BtcRelayAbi_1.BtcRelayAbi, contractDeploymentHeight ??
            (btcRelayAddreses[bitcoinNetwork] === contractAddress
                ? btcRelayDeploymentHeights[bitcoinNetwork]
                : undefined));
        this.maxHeadersPerTx = 40;
        this.maxForkHeadersPerTx = 30;
        this.maxShortForkHeadersPerTx = 40;
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
     * @param signer Starknet signer's address
     * @param headers Bitcoin blockheaders to submit to the btc relay
     * @param storedHeader Current latest stored block header for a given fork or main chain
     * @param forkId Fork ID to submit to, `forkId`=0 means main chain, `forkId`=-1 means short fork
     * @param feeRate Fee rate for the transaction
     * @private
     */
    async _saveHeaders(signer, headers, storedHeader, forkId, feeRate) {
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
        return {
            forkId: forkId,
            lastStoredHeader,
            tx,
            computedCommitedHeaders
        };
    }
    /**
     * Returns a committed bitcoin blockheader based on the provided `commitHash` or `blockHash`
     *
     * @param commitHash Commitment hash of the stored blockheader
     * @param blockHash Block's hash
     * @private
     */
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
    /**
     * Returns the current main chain blockheight of the BTC Relay
     *
     * @private
     */
    async getBlockHeight() {
        return Number(await this.contract.get_blockheight());
    }
    /**
     * @inheritDoc
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
     * @inheritDoc
     */
    async retrieveLogAndBlockheight(blockData, requiredBlockheight) {
        //TODO: we can fetch the blockheight and events in parallel
        const blockHeight = await this.getBlockHeight();
        if (requiredBlockheight != null && blockHeight < requiredBlockheight) {
            return null;
        }
        const result = await this.getBlock(undefined, buffer_1.Buffer.from(blockData.blockhash, "hex"));
        if (result == null)
            return null;
        const [storedBlockHeader, commitHash] = result;
        //Check if block is part of the main chain
        const chainCommitment = await this.contract.get_commit_hash(storedBlockHeader.getBlockheight());
        if (BigInt(chainCommitment) !== BigInt(commitHash))
            return null;
        logger.debug("retrieveLogAndBlockheight(): block found," +
            " commit hash: " + (0, Utils_1.toHex)(commitHash) + " blockhash: " + blockData.blockhash + " current btc relay height: " + blockHeight);
        return { header: storedBlockHeader, height: blockHeight };
    }
    /**
     * @inheritDoc
     */
    async retrieveLogByCommitHash(commitmentHash, blockData) {
        const result = await this.getBlock(commitmentHash, buffer_1.Buffer.from(blockData.blockhash, "hex"));
        if (result == null)
            return null;
        const [storedBlockHeader, commitHash] = result;
        //Check if block is part of the main chain
        const chainCommitment = await this.contract.get_commit_hash(storedBlockHeader.getBlockheight());
        if (BigInt(chainCommitment) !== BigInt(commitHash))
            return null;
        logger.debug("retrieveLogByCommitHash(): block found," +
            " commit hash: " + commitmentHash + " blockhash: " + blockData.blockhash + " height: " + storedBlockHeader.getBlockheight());
        return storedBlockHeader;
    }
    /**
     * @inheritDoc
     */
    async retrieveLatestKnownBlockLog() {
        const data = await this.Events.findInContractEvents(["btc_relay::events::StoreHeader", "btc_relay::events::StoreForkHeader"], null, async (event) => {
            const storedHeader = StarknetBtcStoredHeader_1.StarknetBtcStoredHeader.fromSerializedFeltArray(event.data);
            const blockHashHex = storedHeader.getBlockHash().toString("hex");
            const commitHash = event.params.commit_hash;
            const [isInBtcMainChain, btcRelayCommitHash] = await Promise.all([
                this.bitcoinRpc.isInMainChain(blockHashHex).catch(() => false),
                this.contract.get_commit_hash(storedHeader.getBlockheight())
            ]);
            if (!isInBtcMainChain)
                return null;
            if (BigInt(commitHash) !== BigInt(btcRelayCommitHash))
                return null;
            const bitcoinBlockHeader = await this.bitcoinRpc.getBlockHeader(blockHashHex);
            if (bitcoinBlockHeader == null)
                return null;
            return {
                resultStoredHeader: storedHeader,
                resultBitcoinHeader: bitcoinBlockHeader,
                commitHash: commitHash
            };
        });
        if (data != null)
            logger.debug("retrieveLatestKnownBlockLog(): block found," +
                " commit hash: " + (0, Utils_1.toHex)(data.commitHash) + " blockhash: " + data.resultBitcoinHeader.getHash() +
                " height: " + data.resultStoredHeader.getBlockheight());
        return data;
    }
    /**
     * @inheritDoc
     */
    async saveMainHeaders(signer, mainHeaders, storedHeader, feeRate) {
        feeRate ?? (feeRate = await this.getMainFeeRate(signer));
        logger.debug("saveMainHeaders(): submitting main blockheaders, count: " + mainHeaders.length);
        return this._saveHeaders(signer, mainHeaders, storedHeader, 0, feeRate);
    }
    /**
     * @inheritDoc
     */
    async saveNewForkHeaders(signer, forkHeaders, storedHeader, tipWork, feeRate) {
        let forkId = Math.floor(Math.random() * 0xFFFFFFFFFFFF);
        feeRate ?? (feeRate = await this.getForkFeeRate(signer, forkId));
        logger.debug("saveNewForkHeaders(): submitting new fork & blockheaders," +
            " count: " + forkHeaders.length + " forkId: 0x" + forkId.toString(16));
        const result = await this._saveHeaders(signer, forkHeaders, storedHeader, forkId, feeRate);
        if (result.forkId !== 0 && base_1.StatePredictorUtils.gtBuffer(result.lastStoredHeader.getChainWork(), tipWork)) {
            //Fork's work is higher than main chain's work, this fork will become a main chain
            result.forkId = 0;
        }
        return result;
    }
    /**
     * @inheritDoc
     */
    async saveForkHeaders(signer, forkHeaders, storedHeader, forkId, tipWork, feeRate) {
        feeRate ?? (feeRate = await this.getForkFeeRate(signer, forkId));
        logger.debug("saveForkHeaders(): submitting blockheaders to existing fork," +
            " count: " + forkHeaders.length + " forkId: 0x" + forkId.toString(16));
        const result = await this._saveHeaders(signer, forkHeaders, storedHeader, forkId, feeRate);
        if (result.forkId !== 0 && base_1.StatePredictorUtils.gtBuffer(result.lastStoredHeader.getChainWork(), tipWork)) {
            //Fork's work is higher than main chain's work, this fork will become a main chain
            result.forkId = 0;
        }
        return result;
    }
    /**
     * @inheritDoc
     */
    async saveShortForkHeaders(signer, forkHeaders, storedHeader, tipWork, feeRate) {
        feeRate ?? (feeRate = await this.getMainFeeRate(signer));
        logger.debug("saveShortForkHeaders(): submitting short fork blockheaders," +
            " count: " + forkHeaders.length);
        const result = await this._saveHeaders(signer, forkHeaders, storedHeader, -1, feeRate);
        if (result.forkId !== 0 && base_1.StatePredictorUtils.gtBuffer(result.lastStoredHeader.getChainWork(), tipWork)) {
            //Fork's work is higher than main chain's work, this fork will become a main chain
            result.forkId = 0;
        }
        return result;
    }
    /**
     * @inheritDoc
     */
    async estimateSynchronizeFee(requiredBlockheight, feeRate) {
        const tipData = await this.getTipData();
        if (tipData == null)
            throw new Error("Cannot get relay tip data, relay not initialized?");
        const currBlockheight = tipData.blockheight;
        const blockheightDelta = requiredBlockheight - currBlockheight;
        if (blockheightDelta <= 0)
            return 0n;
        const synchronizationFee = BigInt(blockheightDelta) * await this.getFeePerBlock(feeRate);
        logger.debug("estimateSynchronizeFee(): required blockheight: " + requiredBlockheight +
            " blockheight delta: " + blockheightDelta + " fee: " + synchronizationFee.toString(10));
        return synchronizationFee;
    }
    /**
     * @inheritDoc
     */
    async getFeePerBlock(feeRate) {
        feeRate ?? (feeRate = await this.Chain.Fees.getFeeRate());
        return StarknetFees_1.StarknetFees.getGasFee(GAS_PER_BLOCKHEADER, feeRate);
    }
    /**
     * @inheritDoc
     */
    getMainFeeRate(signer) {
        return this.Chain.Fees.getFeeRate();
    }
    /**
     * @inheritDoc
     */
    getForkFeeRate(signer, forkId) {
        return this.Chain.Fees.getFeeRate();
    }
    /**
     * @inheritDoc
     */
    saveInitialHeader(signer, header, epochStart, pastBlocksTimestamps, feeRate) {
        throw new Error("Not supported, starknet contract is initialized with constructor!");
    }
    /**
     * Gets committed headers, identified by blockhash & blockheight, determines required BTC relay blockheight based on
     *  requiredConfirmations.
     * If synchronizer is passed & some blockhash is not found (or blockhash doesn't have enough confirmations),
     *  it produces transactions to sync up the btc relay to the current chain tip & adds them to the passed txs array.
     *
     * @param signer A signer's address to use for the transactions
     * @param btcRelay BtcRelay contract to use for retrieving committed headers
     * @param btcTxs Bitcoin transactions to fetch the stored blockheaders for
     * @param txs Transactions array, in case we need to synchronize the btc relay ourselves the synchronization
     *  txns are added here
     * @param synchronizer optional synchronizer to use to synchronize the btc relay in case it is not yet synchronized
     *  to the required blockheight
     * @param feeRate Fee rate to use for synchronization transactions
     *
     * @private
     */
    static async getCommitedHeadersAndSynchronize(signer, btcRelay, btcTxs, txs, synchronizer, feeRate) {
        const leavesTxs = [];
        const blockheaders = {};
        for (let btcTx of btcTxs) {
            const requiredBlockheight = btcTx.blockheight + btcTx.requiredConfirmations - 1;
            const result = await btcRelay.retrieveLogAndBlockheight({
                blockhash: btcTx.blockhash
            }, requiredBlockheight);
            if (result != null) {
                blockheaders[result.header.getBlockHash().toString("hex")] = result.header;
            }
            else {
                leavesTxs.push(btcTx);
            }
        }
        if (leavesTxs.length === 0)
            return blockheaders;
        //Need to synchronize
        if (synchronizer == null)
            return null;
        //TODO: We don't have to synchronize to tip, only to our required blockheight
        const resp = await synchronizer.syncToLatestTxs(signer.toString(), feeRate);
        logger.debug("getCommitedHeaderAndSynchronize(): BTC Relay not synchronized to required blockheight, " +
            "synchronizing ourselves in " + resp.txs.length + " txs");
        logger.debug("getCommitedHeaderAndSynchronize(): BTC Relay computed header map: ", resp.computedHeaderMap);
        txs.push(...resp.txs);
        for (let key in resp.computedHeaderMap) {
            const header = resp.computedHeaderMap[key];
            blockheaders[header.getBlockHash().toString("hex")] = header;
        }
        //Check that blockhashes of all the rest txs are included
        for (let btcTx of leavesTxs) {
            if (blockheaders[btcTx.blockhash] == null)
                return null;
        }
        //Retrieve computed headers
        return blockheaders;
    }
}
exports.StarknetBtcRelay = StarknetBtcRelay;
