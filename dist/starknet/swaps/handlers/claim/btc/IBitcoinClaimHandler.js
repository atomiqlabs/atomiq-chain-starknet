"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IBitcoinClaimHandler = void 0;
const base_1 = require("@atomiqlabs/base");
const starknet_1 = require("starknet");
const Utils_1 = require("../../../../../utils/Utils");
const logger = (0, Utils_1.getLogger)("IBitcoinClaimHandler: ");
class IBitcoinClaimHandler {
    constructor(address) {
        this.address = address;
    }
    /**
     * Gets committed header, identified by blockhash & blockheight, determines required BTC relay blockheight based on
     *  requiredConfirmations
     * If synchronizer is passed & blockhash is not found, it produces transactions to sync up the btc relay to the
     *  current chain tip & adds them to the txs array
     *
     * @param signer
     * @param btcRelay
     * @param txBlockheight transaction blockheight
     * @param requiredConfirmations required confirmation for the swap to be claimable with that TX
     * @param blockhash blockhash of the block which includes the transaction
     * @param txs solana transaction array, in case we need to synchronize the btc relay ourselves the synchronization
     *  txns are added here
     * @param synchronizer optional synchronizer to use to synchronize the btc relay in case it is not yet synchronized
     *  to the required blockheight
     * @param feeRate Fee rate to use for synchronization transactions
     * @private
     */
    async getCommitedHeaderAndSynchronize(signer, btcRelay, txBlockheight, requiredConfirmations, blockhash, txs, synchronizer, feeRate) {
        const requiredBlockheight = txBlockheight + requiredConfirmations - 1;
        const result = await (0, Utils_1.tryWithRetries)(() => btcRelay.retrieveLogAndBlockheight({
            blockhash: blockhash
        }, requiredBlockheight));
        if (result != null)
            return result.header;
        //Need to synchronize
        if (synchronizer == null)
            return null;
        //TODO: We don't have to synchronize to tip, only to our required blockheight
        const resp = await synchronizer.syncToLatestTxs(signer.toString(), feeRate);
        logger.debug("getCommitedHeaderAndSynchronize(): BTC Relay not synchronized to required blockheight, " +
            "synchronizing ourselves in " + resp.txs.length + " txs");
        logger.debug("getCommitedHeaderAndSynchronize(): BTC Relay computed header map: ", resp.computedHeaderMap);
        resp.txs.forEach(tx => txs.push(tx));
        //Retrieve computed header
        return resp.computedHeaderMap[txBlockheight];
    }
    serializeCommitment(data) {
        return [
            data.confirmations,
            data.btcRelay.contract.address
        ];
    }
    getCommitment(data) {
        return starknet_1.hash.computePoseidonHashOnElements(this.serializeCommitment(data));
    }
    async _getWitness(signer, swapData, { tx, btcRelay, commitedHeader, synchronizer, requiredConfirmations }, commitment, feeRate) {
        const serializedData = this.serializeCommitment({
            ...commitment,
            btcRelay,
            confirmations: requiredConfirmations
        });
        const commitmentHash = starknet_1.hash.computePoseidonHashOnElements(serializedData);
        if (!swapData.isClaimData(commitmentHash))
            throw new Error("Invalid commit data");
        const merkleProof = await btcRelay.bitcoinRpc.getMerkleProof(tx.txid, tx.blockhash);
        logger.debug("getWitness(): merkle proof computed: ", merkleProof);
        const txs = [];
        if (commitedHeader == null)
            commitedHeader = await this.getCommitedHeaderAndSynchronize(signer, btcRelay, tx.height, requiredConfirmations, tx.blockhash, txs, synchronizer, feeRate);
        if (commitedHeader == null)
            throw new Error("Cannot fetch committed header!");
        serializedData.push(...commitedHeader.serialize());
        serializedData.push(merkleProof.merkle.length, ...merkleProof.merkle.map(Utils_1.bufferToU32Array).flat());
        serializedData.push(merkleProof.pos);
        return { initialTxns: txs, witness: serializedData };
    }
    parseWitnessResult(result) {
        return (0, Utils_1.u32ArrayToBuffer)(result).toString("hex");
    }
}
exports.IBitcoinClaimHandler = IBitcoinClaimHandler;
IBitcoinClaimHandler.address = "";
IBitcoinClaimHandler.type = base_1.ChainSwapType.CHAIN_TXID;
IBitcoinClaimHandler.gas = { l1: 20000 };
