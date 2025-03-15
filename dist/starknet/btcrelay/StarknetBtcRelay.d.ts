import { Buffer } from "buffer";
import { StarknetBtcHeader } from "./headers/StarknetBtcHeader";
import { BitcoinRpc, BtcBlock, BtcRelay } from "@atomiqlabs/base";
import { StarknetContractBase } from "../contract/StarknetContractBase";
import { StarknetBtcStoredHeader } from "./headers/StarknetBtcStoredHeader";
import { StarknetTx } from "../base/modules/StarknetTransactions";
import { StarknetSigner } from "../wallet/StarknetSigner";
import { BtcRelayAbi } from "./BtcRelayAbi";
import { constants, Provider } from "starknet";
import { StarknetFees } from "../base/modules/StarknetFees";
import { StarknetRetryPolicy } from "../base/StarknetBase";
import { StarknetAction } from "../base/StarknetAction";
export declare class StarknetBtcRelay<B extends BtcBlock> extends StarknetContractBase<typeof BtcRelayAbi> implements BtcRelay<StarknetBtcStoredHeader, StarknetTx, B, StarknetSigner> {
    SaveMainHeaders(signer: string, mainHeaders: StarknetBtcHeader[], storedHeader: StarknetBtcStoredHeader): StarknetAction;
    SaveShortForkHeaders(signer: string, forkHeaders: StarknetBtcHeader[], storedHeader: StarknetBtcStoredHeader): StarknetAction;
    SaveLongForkHeaders(signer: string, forkId: number, forkHeaders: StarknetBtcHeader[], storedHeader: StarknetBtcStoredHeader, totalForkHeaders?: number): StarknetAction;
    bitcoinRpc: BitcoinRpc<B>;
    readonly maxHeadersPerTx: number;
    readonly maxForkHeadersPerTx: number;
    readonly maxShortForkHeadersPerTx: number;
    constructor(chainId: constants.StarknetChainId, provider: Provider, bitcoinRpc: BitcoinRpc<B>, contractAddress?: string, retryPolicy?: StarknetRetryPolicy, solanaFeeEstimator?: StarknetFees);
    /**
     * Computes subsequent commited headers as they will appear on the blockchain when transactions
     *  are submitted & confirmed
     *
     * @param initialStoredHeader
     * @param syncedHeaders
     * @private
     */
    private computeCommitedHeaders;
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
    private _saveHeaders;
    private getBlock;
    private getBlockHeight;
    /**
     * Returns data about current main chain tip stored in the btc relay
     */
    getTipData(): Promise<{
        commitHash: string;
        blockhash: string;
        chainWork: Buffer;
        blockheight: number;
    }>;
    /**
     * Retrieves blockheader with a specific blockhash, returns null if requiredBlockheight is provided and
     *  btc relay contract is not synced up to the desired blockheight
     *
     * @param blockData
     * @param requiredBlockheight
     */
    retrieveLogAndBlockheight(blockData: {
        blockhash: string;
    }, requiredBlockheight?: number): Promise<{
        header: StarknetBtcStoredHeader;
        height: number;
    } | null>;
    /**
     * Retrieves blockheader data by blockheader's commit hash,
     *
     * @param commitmentHashStr
     * @param blockData
     */
    retrieveLogByCommitHash(commitmentHashStr: string, blockData: {
        blockhash: string;
    }): Promise<StarknetBtcStoredHeader>;
    /**
     * Retrieves latest known stored blockheader & blockheader from bitcoin RPC that is in the main chain
     */
    retrieveLatestKnownBlockLog(): Promise<{
        resultStoredHeader: StarknetBtcStoredHeader;
        resultBitcoinHeader: B;
    }>;
    /**
     * Saves blockheaders as a bitcoin main chain to the btc relay
     *
     * @param signer
     * @param mainHeaders
     * @param storedHeader
     * @param feeRate
     */
    saveMainHeaders(signer: string, mainHeaders: BtcBlock[], storedHeader: StarknetBtcStoredHeader, feeRate?: string): Promise<{
        forkId: number;
        lastStoredHeader: StarknetBtcStoredHeader;
        tx: StarknetTx;
        computedCommitedHeaders: StarknetBtcStoredHeader[];
    }>;
    /**
     * Creates a new long fork and submits the headers to it
     *
     * @param signer
     * @param forkHeaders
     * @param storedHeader
     * @param tipWork
     * @param feeRate
     */
    saveNewForkHeaders(signer: string, forkHeaders: BtcBlock[], storedHeader: StarknetBtcStoredHeader, tipWork: Buffer, feeRate?: string): Promise<{
        forkId: number;
        lastStoredHeader: StarknetBtcStoredHeader;
        tx: StarknetTx;
        computedCommitedHeaders: StarknetBtcStoredHeader[];
    }>;
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
    saveForkHeaders(signer: string, forkHeaders: BtcBlock[], storedHeader: StarknetBtcStoredHeader, forkId: number, tipWork: Buffer, feeRate?: string): Promise<{
        forkId: number;
        lastStoredHeader: StarknetBtcStoredHeader;
        tx: StarknetTx;
        computedCommitedHeaders: StarknetBtcStoredHeader[];
    }>;
    /**
     * Submits short fork with given blockheaders
     *
     * @param signer
     * @param forkHeaders
     * @param storedHeader
     * @param tipWork
     * @param feeRate
     */
    saveShortForkHeaders(signer: string, forkHeaders: BtcBlock[], storedHeader: StarknetBtcStoredHeader, tipWork: Buffer, feeRate?: string): Promise<{
        forkId: number;
        lastStoredHeader: StarknetBtcStoredHeader;
        tx: StarknetTx;
        computedCommitedHeaders: StarknetBtcStoredHeader[];
    }>;
    /**
     * Estimate required synchronization fee (worst case) to synchronize btc relay to the required blockheight
     *
     * @param requiredBlockheight
     * @param feeRate
     */
    estimateSynchronizeFee(requiredBlockheight: number, feeRate?: string): Promise<bigint>;
    /**
     * Returns fee required (in SOL) to synchronize a single block to btc relay
     *
     * @param feeRate
     */
    getFeePerBlock(feeRate?: string): Promise<bigint>;
    /**
     * Gets fee rate required for submitting blockheaders to the main chain
     */
    getMainFeeRate(signer: string | null): Promise<string>;
    /**
     * Gets fee rate required for submitting blockheaders to the specific fork
     */
    getForkFeeRate(signer: string, forkId: number): Promise<string>;
    saveInitialHeader(signer: string, header: B, epochStart: number, pastBlocksTimestamps: number[], feeRate?: string): Promise<StarknetTx>;
}
