import {IClaimHandler} from "../ClaimHandlers";
import {StarknetSwapData} from "../../../StarknetSwapData";
import {StarknetGas} from "../../../../base/StarknetAction";
import {ChainSwapType, RelaySynchronizer} from "@atomiqlabs/base";
import {BigNumberish, hash} from "starknet";
import {StarknetBtcStoredHeader} from "../../../../btcrelay/headers/StarknetBtcStoredHeader";
import {StarknetTx} from "../../../../base/modules/StarknetTransactions";
import {StarknetBtcRelay} from "../../../../btcrelay/StarknetBtcRelay";
import {bufferToU32Array, getLogger, toHex, tryWithRetries, u32ArrayToBuffer} from "../../../../../utils/Utils";

export type BitcoinCommitmentData = {
    btcRelay: StarknetBtcRelay<any>,
    confirmations: number
}

export type BitcoinWitnessData = {
    tx: { blockhash: string, confirmations: number, txid: string, hex: string, height: number },
    requiredConfirmations: number,
    commitedHeader?: StarknetBtcStoredHeader,
    btcRelay?: StarknetBtcRelay<any>,
    synchronizer?: RelaySynchronizer<StarknetBtcStoredHeader, StarknetTx, any>
};

const logger = getLogger("IBitcoinClaimHandler: ");

export abstract class IBitcoinClaimHandler<C, W extends BitcoinWitnessData> implements IClaimHandler<C & BitcoinCommitmentData, W> {

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
    protected async getCommitedHeaderAndSynchronize(
        signer: string,
        btcRelay: StarknetBtcRelay<any>,
        txBlockheight: number,
        requiredConfirmations: number,
        blockhash: string,
        txs: StarknetTx[],
        synchronizer?: RelaySynchronizer<StarknetBtcStoredHeader, StarknetTx, any>,
        feeRate?: string
    ): Promise<StarknetBtcStoredHeader> {
        const requiredBlockheight = txBlockheight+requiredConfirmations-1;

        const result = await tryWithRetries(
            () => btcRelay.retrieveLogAndBlockheight({
                blockhash: blockhash
            }, requiredBlockheight)
        );

        if(result!=null) return result.header;

        //Need to synchronize
        if(synchronizer==null) return null;

        //TODO: We don't have to synchronize to tip, only to our required blockheight
        const resp = await synchronizer.syncToLatestTxs(signer.toString(), feeRate);
        logger.debug("getCommitedHeaderAndSynchronize(): BTC Relay not synchronized to required blockheight, "+
            "synchronizing ourselves in "+resp.txs.length+" txs");
        logger.debug("getCommitedHeaderAndSynchronize(): BTC Relay computed header map: ",resp.computedHeaderMap);
        resp.txs.forEach(tx => txs.push(tx));

        //Retrieve computed header
        return resp.computedHeaderMap[txBlockheight];
    }

    public static readonly address = "";
    public static readonly type: ChainSwapType = ChainSwapType.CHAIN_TXID;
    public static readonly gas: StarknetGas = {l1: 20000};

    protected serializeCommitment(data: BitcoinCommitmentData): BigNumberish[] {
        return [
            data.confirmations,
            data.btcRelay.contract.address
        ]
    }

    getCommitment(data: C & BitcoinCommitmentData): BigNumberish {
        return hash.computePoseidonHashOnElements(this.serializeCommitment(data));
    }

    protected async _getWitness(
        signer: string,
        swapData: StarknetSwapData,
        {tx, btcRelay, commitedHeader, synchronizer, requiredConfirmations}: BitcoinWitnessData,
        commitment: C,
        feeRate?: string
    ): Promise<{
        initialTxns: StarknetTx[];
        witness: BigNumberish[]
    }> {
        const serializedData: BigNumberish[] = this.serializeCommitment({
            ...commitment,
            btcRelay,
            confirmations: requiredConfirmations
        });
        const commitmentHash = hash.computePoseidonHashOnElements(serializedData);

        if(!swapData.isClaimData(toHex(commitmentHash))) throw new Error("Invalid commit data");

        const merkleProof = await btcRelay.bitcoinRpc.getMerkleProof(tx.txid, tx.blockhash);
        logger.debug("getWitness(): merkle proof computed: ", merkleProof);

        const txs: StarknetTx[] = [];
        if(commitedHeader==null) commitedHeader = await this.getCommitedHeaderAndSynchronize(
            signer, btcRelay, tx.height, requiredConfirmations,
            tx.blockhash, txs, synchronizer, feeRate
        );

        if(commitedHeader==null) throw new Error("Cannot fetch committed header!");

        serializedData.push(...commitedHeader.serialize());
        serializedData.push(merkleProof.merkle.length, ...merkleProof.merkle.map(bufferToU32Array).flat());
        serializedData.push(merkleProof.pos);

        return {initialTxns: txs, witness: serializedData};
    }

    abstract getWitness(signer: string, data: StarknetSwapData, witnessData: W, feeRate?: string): Promise<{
        initialTxns: StarknetTx[];
        witness: BigNumberish[]
    }>;

    abstract getGas(data: StarknetSwapData): StarknetGas;

    abstract getType(): ChainSwapType;

    parseWitnessResult(result: BigNumberish[]): string {
        return u32ArrayToBuffer(result).toString("hex");
    }

}
