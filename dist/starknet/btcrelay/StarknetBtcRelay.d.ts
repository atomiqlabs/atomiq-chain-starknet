import { Buffer } from "buffer";
import { StarknetBtcHeader } from "./headers/StarknetBtcHeader";
import { BitcoinNetwork, BitcoinRpc, BtcBlock, BtcRelay, RelaySynchronizer } from "@atomiqlabs/base";
import { StarknetContractBase } from "../contract/StarknetContractBase";
import { StarknetBtcStoredHeader } from "./headers/StarknetBtcStoredHeader";
import { StarknetTx } from "../chain/modules/StarknetTransactions";
import { StarknetSigner } from "../wallet/StarknetSigner";
import { BtcRelayAbi } from "./BtcRelayAbi";
import { StarknetChainInterface } from "../chain/StarknetChainInterface";
import { StarknetAction } from "../chain/StarknetAction";
/**
 * Starknet BTC Relay bitcoin light client contract representation
 *
 * @category BTC Relay
 */
export declare class StarknetBtcRelay<B extends BtcBlock> extends StarknetContractBase<typeof BtcRelayAbi> implements BtcRelay<StarknetBtcStoredHeader, StarknetTx, B, StarknetSigner> {
    /**
     * Returns a {@link StarknetAction} that submits new main chain bitcoin blockheaders to the light client
     *
     * @param signer Starknet signer's address
     * @param mainHeaders New bitcoin blockheaders to submit
     * @param storedHeader Current latest committed and stored bitcoin blockheader in the light client
     */
    SaveMainHeaders(signer: string, mainHeaders: StarknetBtcHeader[], storedHeader: StarknetBtcStoredHeader): StarknetAction;
    /**
     * Returns a {@link StarknetAction} for submitting a short fork bitcoin blockheaders to the light client,
     *  forking the chain from the provided `storedHeader` param's blockheight. For a successful fork the
     *  submitted chain needs to have higher total chainwork than the current cannonical chain
     *
     * @param signer Starknet signer's address
     * @param forkHeaders Fork bitcoin blockheaders to submit
     * @param storedHeader Committed and stored bitcoin blockheader from which to fork the light client
     */
    SaveShortForkHeaders(signer: string, forkHeaders: StarknetBtcHeader[], storedHeader: StarknetBtcStoredHeader): StarknetAction;
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
    SaveLongForkHeaders(signer: string, forkId: number, forkHeaders: StarknetBtcHeader[], storedHeader: StarknetBtcStoredHeader, totalForkHeaders?: number): StarknetAction;
    bitcoinRpc: BitcoinRpc<B>;
    readonly maxHeadersPerTx: number;
    readonly maxForkHeadersPerTx: number;
    readonly maxShortForkHeadersPerTx: number;
    constructor(chainInterface: StarknetChainInterface, bitcoinRpc: BitcoinRpc<B>, bitcoinNetwork: BitcoinNetwork, contractAddress?: string | undefined, contractDeploymentHeight?: number);
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
     * @param signer Starknet signer's address
     * @param headers Bitcoin blockheaders to submit to the btc relay
     * @param storedHeader Current latest stored block header for a given fork or main chain
     * @param forkId Fork ID to submit to, `forkId`=0 means main chain, `forkId`=-1 means short fork
     * @param feeRate Fee rate for the transaction
     * @private
     */
    private _saveHeaders;
    /**
     * Returns a committed bitcoin blockheader based on the provided `commitHash` or `blockHash`
     *
     * @param commitHash Commitment hash of the stored blockheader
     * @param blockHash Block's hash
     * @private
     */
    private getBlock;
    /**
     * Returns the current main chain blockheight of the BTC Relay
     *
     * @private
     */
    private getBlockHeight;
    /**
     * @inheritDoc
     */
    getTipData(): Promise<{
        commitHash: string;
        blockhash: string;
        chainWork: Buffer;
        blockheight: number;
    } | null>;
    /**
     * @inheritDoc
     */
    retrieveLogAndBlockheight(blockData: {
        blockhash: string;
    }, requiredBlockheight?: number): Promise<{
        header: StarknetBtcStoredHeader;
        height: number;
    } | null>;
    /**
     * @inheritDoc
     */
    retrieveLogByCommitHash(commitmentHash: string, blockData: {
        blockhash: string;
    }): Promise<StarknetBtcStoredHeader | null>;
    /**
     * @inheritDoc
     */
    retrieveLatestKnownBlockLog(): Promise<{
        resultStoredHeader: StarknetBtcStoredHeader;
        resultBitcoinHeader: B;
    } | null>;
    /**
     * @inheritDoc
     */
    saveMainHeaders(signer: string, mainHeaders: BtcBlock[], storedHeader: StarknetBtcStoredHeader, feeRate?: string): Promise<{
        forkId: number;
        lastStoredHeader: StarknetBtcStoredHeader;
        tx: StarknetTx;
        computedCommitedHeaders: StarknetBtcStoredHeader[];
    }>;
    /**
     * @inheritDoc
     */
    saveNewForkHeaders(signer: string, forkHeaders: BtcBlock[], storedHeader: StarknetBtcStoredHeader, tipWork: Buffer, feeRate?: string): Promise<{
        forkId: number;
        lastStoredHeader: StarknetBtcStoredHeader;
        tx: StarknetTx;
        computedCommitedHeaders: StarknetBtcStoredHeader[];
    }>;
    /**
     * @inheritDoc
     */
    saveForkHeaders(signer: string, forkHeaders: BtcBlock[], storedHeader: StarknetBtcStoredHeader, forkId: number, tipWork: Buffer, feeRate?: string): Promise<{
        forkId: number;
        lastStoredHeader: StarknetBtcStoredHeader;
        tx: StarknetTx;
        computedCommitedHeaders: StarknetBtcStoredHeader[];
    }>;
    /**
     * @inheritDoc
     */
    saveShortForkHeaders(signer: string, forkHeaders: BtcBlock[], storedHeader: StarknetBtcStoredHeader, tipWork: Buffer, feeRate?: string): Promise<{
        forkId: number;
        lastStoredHeader: StarknetBtcStoredHeader;
        tx: StarknetTx;
        computedCommitedHeaders: StarknetBtcStoredHeader[];
    }>;
    /**
     * @inheritDoc
     */
    estimateSynchronizeFee(requiredBlockheight: number, feeRate?: string): Promise<bigint>;
    /**
     * @inheritDoc
     */
    getFeePerBlock(feeRate?: string): Promise<bigint>;
    /**
     * @inheritDoc
     */
    getMainFeeRate(signer: string | null): Promise<string>;
    /**
     * @inheritDoc
     */
    getForkFeeRate(signer: string, forkId: number): Promise<string>;
    /**
     * @inheritDoc
     */
    saveInitialHeader(signer: string, header: B, epochStart: number, pastBlocksTimestamps: number[], feeRate?: string): Promise<StarknetTx>;
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
    static getCommitedHeadersAndSynchronize(signer: string, btcRelay: StarknetBtcRelay<any>, btcTxs: {
        blockheight: number;
        requiredConfirmations: number;
        blockhash: string;
    }[], txs: StarknetTx[], synchronizer?: RelaySynchronizer<StarknetBtcStoredHeader, StarknetTx, any>, feeRate?: string): Promise<{
        [blockhash: string]: StarknetBtcStoredHeader;
    } | null>;
}
