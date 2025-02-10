import { IClaimHandler } from "../ClaimHandlers";
import { StarknetSwapData } from "../../../StarknetSwapData";
import { StarknetGas } from "../../../../base/StarknetAction";
import { ChainSwapType, RelaySynchronizer } from "@atomiqlabs/base";
import { BigNumberish } from "starknet";
import { StarknetBtcStoredHeader } from "../../../../btcrelay/headers/StarknetBtcStoredHeader";
import { StarknetTx } from "../../../../base/modules/StarknetTransactions";
import { StarknetBtcRelay } from "../../../../btcrelay/StarknetBtcRelay";
export type BitcoinCommitmentData = {
    btcRelay: StarknetBtcRelay<any>;
    confirmations: number;
};
export type BitcoinWitnessData = {
    tx: {
        blockhash: string;
        confirmations: number;
        txid: string;
        hex: string;
        height: number;
    };
    requiredConfirmations: number;
    commitedHeader?: StarknetBtcStoredHeader;
    btcRelay?: StarknetBtcRelay<any>;
    synchronizer?: RelaySynchronizer<StarknetBtcStoredHeader, StarknetTx, any>;
};
export declare abstract class IBitcoinClaimHandler<C, W extends BitcoinWitnessData> implements IClaimHandler<C & BitcoinCommitmentData, W> {
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
    protected getCommitedHeaderAndSynchronize(signer: string, btcRelay: StarknetBtcRelay<any>, txBlockheight: number, requiredConfirmations: number, blockhash: string, txs: StarknetTx[], synchronizer?: RelaySynchronizer<StarknetBtcStoredHeader, StarknetTx, any>, feeRate?: string): Promise<StarknetBtcStoredHeader>;
    static readonly address = "";
    static readonly type: ChainSwapType;
    static readonly gas: StarknetGas;
    protected serializeCommitment(data: BitcoinCommitmentData): BigNumberish[];
    getCommitment(data: C & BitcoinCommitmentData): BigNumberish;
    protected _getWitness(signer: string, swapData: StarknetSwapData, { tx, btcRelay, commitedHeader, synchronizer, requiredConfirmations }: BitcoinWitnessData, commitment: C, feeRate?: string): Promise<{
        initialTxns: StarknetTx[];
        witness: BigNumberish[];
    }>;
    abstract getWitness(signer: string, data: StarknetSwapData, witnessData: W, feeRate?: string): Promise<{
        initialTxns: StarknetTx[];
        witness: BigNumberish[];
    }>;
    abstract getGas(data: StarknetSwapData): StarknetGas;
    abstract getType(): ChainSwapType;
    parseWitnessResult(result: BigNumberish[]): string;
}
