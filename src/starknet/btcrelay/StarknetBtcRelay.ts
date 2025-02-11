import * as BN from "bn.js";
import {Buffer} from "buffer";
import {StarknetBtcHeader} from "./headers/StarknetBtcHeader";
import {BitcoinRpc, BtcBlock, BtcRelay, StatePredictorUtils} from "@atomiqlabs/base";
import {
    bigNumberishToBuffer,
    bufferToU32Array,
    toHex,
    u32ReverseEndianness
} from "../../utils/Utils";
import {StarknetContractBase} from "../contract/StarknetContractBase";
import {StarknetBtcStoredHeader} from "./headers/StarknetBtcStoredHeader";
import {StarknetTx} from "../base/modules/StarknetTransactions";
import {StarknetSigner} from "../wallet/StarknetSigner";
import {BtcRelayAbi} from "./BtcRelayAbi";
import {BigNumberish, constants, hash, Provider} from "starknet";
import {StarknetFees} from "../base/modules/StarknetFees";
import {StarknetRetryPolicy} from "../base/StarknetBase";
import {StarknetAction} from "../base/StarknetAction";
import * as randomBytes from "randombytes";

function serializeBlockHeader(e: BtcBlock): StarknetBtcHeader {
    return new StarknetBtcHeader({
        reversed_version: u32ReverseEndianness(e.getVersion()),
        previous_blockhash: bufferToU32Array(Buffer.from(e.getPrevBlockhash(), "hex").reverse()),
        merkle_root: bufferToU32Array(Buffer.from(e.getMerkleRoot(), "hex").reverse()),
        reversed_timestamp: u32ReverseEndianness(e.getTimestamp()),
        nbits: u32ReverseEndianness(e.getNbits()),
        nonce: u32ReverseEndianness(e.getNonce()),
        hash: Buffer.from(e.getHash(), "hex").reverse()
    });
}

const GAS_PER_BLOCKHEADER = 750;
const GAS_PER_BLOCKHEADER_FORK = 750;

const btcRelayAddreses = {
    [constants.StarknetChainId.SN_SEPOLIA]: "0x03e0a5aaca6e679e701c9cd68f3447115b00ec749f4d040488d5ba14101bc86e",
    [constants.StarknetChainId.SN_MAIN]: ""
};

export class StarknetBtcRelay<B extends BtcBlock>
    extends StarknetContractBase<typeof BtcRelayAbi>
    implements BtcRelay<StarknetBtcStoredHeader, StarknetTx, B, StarknetSigner> {

    public SaveMainHeaders(signer: string, mainHeaders: StarknetBtcHeader[], storedHeader: StarknetBtcStoredHeader): StarknetAction {
        return new StarknetAction(signer, this,
            this.contract.populateTransaction.submit_main_blockheaders(mainHeaders, storedHeader),
            {l1: GAS_PER_BLOCKHEADER * mainHeaders.length, l2: 0}
        )
    }

    public SaveShortForkHeaders(signer: string, forkHeaders: StarknetBtcHeader[], storedHeader: StarknetBtcStoredHeader): StarknetAction {
        return new StarknetAction(signer, this,
            this.contract.populateTransaction.submit_short_fork_blockheaders(forkHeaders, storedHeader),
            {l1: GAS_PER_BLOCKHEADER * forkHeaders.length, l2: 0}
        )
    }

    public SaveLongForkHeaders(signer: string, forkId: number, forkHeaders: StarknetBtcHeader[], storedHeader: StarknetBtcStoredHeader, totalForkHeaders: number = 100): StarknetAction {
        return new StarknetAction(signer, this,
            this.contract.populateTransaction.submit_fork_blockheaders(forkId, forkHeaders, storedHeader),
            {l1: (GAS_PER_BLOCKHEADER * forkHeaders.length) + (GAS_PER_BLOCKHEADER_FORK * totalForkHeaders), l2: 0}
        )
    }

    bitcoinRpc: BitcoinRpc<B>;

    readonly maxHeadersPerTx: number = 25;
    readonly maxForkHeadersPerTx: number = 25;
    readonly maxShortForkHeadersPerTx: number = 25;

    constructor(
        chainId: constants.StarknetChainId,
        provider: Provider,
        bitcoinRpc: BitcoinRpc<B>,
        contractAddress: string = btcRelayAddreses[chainId],
        retryPolicy?: StarknetRetryPolicy,
        solanaFeeEstimator: StarknetFees = new StarknetFees(provider)
    ) {
        super(chainId, provider, contractAddress, BtcRelayAbi, retryPolicy, solanaFeeEstimator);
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
    private computeCommitedHeaders(initialStoredHeader: StarknetBtcStoredHeader, syncedHeaders: StarknetBtcHeader[]) {
        const computedCommitedHeaders = [initialStoredHeader];
        for(let blockHeader of syncedHeaders) {
            computedCommitedHeaders.push(computedCommitedHeaders[computedCommitedHeaders.length-1].computeNext(blockHeader));
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
    private async _saveHeaders(
        signer: string,
        headers: BtcBlock[],
        storedHeader: StarknetBtcStoredHeader,
        tipWork: Buffer,
        forkId: number,
        feeRate: string
    ) {
        const blockHeaderObj = headers.map(serializeBlockHeader);
        let starknetAction: StarknetAction;
        switch(forkId) {
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
        const lastStoredHeader = computedCommitedHeaders[computedCommitedHeaders.length-1];
        if(forkId!==0 && StatePredictorUtils.gtBuffer(lastStoredHeader.getBlockHash(), tipWork)) {
            //Fork's work is higher than main chain's work, this fork will become a main chain
            forkId = 0;
        }

        return {
            forkId: forkId,
            lastStoredHeader,
            tx,
            computedCommitedHeaders
        }
    }

    private getBlock(commitHash?: BigNumberish, blockHash?: Buffer): Promise<[StarknetBtcStoredHeader, bigint] | null> {
        const keys = [commitHash == null ? null : toHex(commitHash)];
        if (blockHash != null) {
            const starknetBlockHash = hash.computePoseidonHashOnElements(bufferToU32Array(Buffer.from([...blockHash]).reverse()));
            keys.push(starknetBlockHash);
        }
        return this.Events.findInContractEvents(
            ["btc_relay::events::StoreHeader", "btc_relay::events::StoreForkHeader"],
            keys,
            (event) => {
                return Promise.resolve([StarknetBtcStoredHeader.fromSerializedFeltArray(event.data), BigInt(event.params.commit_hash)]);
            }
        );
    }

    private async getBlockHeight(): Promise<number> {
        return Number(await this.contract.get_blockheight());
    }

    /**
     * Returns data about current main chain tip stored in the btc relay
     */
    public async getTipData(): Promise<{ commitHash: string; blockhash: string, chainWork: Buffer, blockheight: number }> {
        const commitHash = await this.contract.get_tip_commit_hash();
        if(commitHash==null || BigInt(commitHash)===BigInt(0)) return null;

        const result = await this.getBlock(commitHash);
        if(result==null) return null;

        const [storedBlockHeader] = result;

        return {
            blockheight: storedBlockHeader.getBlockheight(),
            commitHash: bigNumberishToBuffer(commitHash, 32).toString("hex"),
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
    public async retrieveLogAndBlockheight(blockData: {blockhash: string}, requiredBlockheight?: number): Promise<{
        header: StarknetBtcStoredHeader,
        height: number
    } | null> {
        //TODO: we can fetch the blockheight and events in parallel
        const blockHeight = await this.getBlockHeight();
        if(requiredBlockheight!=null && blockHeight < requiredBlockheight) {
            return null;
        }
        const result = await this.getBlock(null, Buffer.from(blockData.blockhash, "hex"));
        if(result==null) return null;

        const [storedBlockHeader, commitHash] = result;

        //Check if block is part of the main chain
        const chainCommitment = await this.contract.get_commit_hash(storedBlockHeader.block_height);
        if(BigInt(chainCommitment)!==BigInt(commitHash)) return null;

        this.logger.debug("retrieveLogAndBlockheight(): block found," +
            " commit hash: "+toHex(commitHash)+" blockhash: "+blockData.blockhash+" current btc relay height: "+blockHeight);

        return {header: storedBlockHeader, height: blockHeight};
    }

    /**
     * Retrieves blockheader data by blockheader's commit hash,
     *
     * @param commitmentHashStr
     * @param blockData
     */
    public async retrieveLogByCommitHash(commitmentHashStr: string, blockData: {blockhash: string}): Promise<StarknetBtcStoredHeader> {
        const result = await this.getBlock(commitmentHashStr, Buffer.from(blockData.blockhash, "hex"));
        if(result==null) return null;

        const [storedBlockHeader, commitHash] = result;

        //Check if block is part of the main chain
        const chainCommitment = await this.contract.get_commit_hash(storedBlockHeader.block_height);
        if(BigInt(chainCommitment)!==BigInt(commitHash)) return null;

        this.logger.debug("retrieveLogByCommitHash(): block found," +
            " commit hash: "+commitmentHashStr+" blockhash: "+blockData.blockhash+" height: "+storedBlockHeader.block_height);

        return storedBlockHeader;
    }

    /**
     * Retrieves latest known stored blockheader & blockheader from bitcoin RPC that is in the main chain
     */
    public async retrieveLatestKnownBlockLog(): Promise<{
        resultStoredHeader: StarknetBtcStoredHeader,
        resultBitcoinHeader: B
    }> {
        const data = await this.Events.findInContractEvents(
            ["btc_relay::events::StoreHeader", "btc_relay::events::StoreForkHeader"],
            null,
            async (event) => {
                const storedHeader = StarknetBtcStoredHeader.fromSerializedFeltArray(event.data);

                const blockHashHex = storedHeader.getBlockHash().toString("hex");
                const commitHash = event.params.commit_hash;

                const [isInBtcMainChain, btcRelayCommitHash] = await Promise.all([
                    this.bitcoinRpc.isInMainChain(blockHashHex).catch(() => false),
                    this.contract.get_commit_hash(storedHeader.block_height)
                ]);

                if(!isInBtcMainChain) return null;
                if(BigInt(commitHash)!==BigInt(btcRelayCommitHash)) return null;

                return {
                    resultStoredHeader: storedHeader,
                    resultBitcoinHeader: await this.bitcoinRpc.getBlockHeader(blockHashHex),
                    commitHash: commitHash
                }
            }
        )

        if(data!=null) this.logger.debug("retrieveLatestKnownBlockLog(): block found," +
            " commit hash: "+toHex(data.commitHash)+" blockhash: "+data.resultBitcoinHeader.getHash()+
            " height: "+data.resultStoredHeader.getBlockheight());

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
    public saveMainHeaders(signer: string, mainHeaders: BtcBlock[], storedHeader: StarknetBtcStoredHeader, feeRate?: string) {
        this.logger.debug("saveMainHeaders(): submitting main blockheaders, count: "+mainHeaders.length);
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
    public async saveNewForkHeaders(signer: string, forkHeaders: BtcBlock[], storedHeader: StarknetBtcStoredHeader, tipWork: Buffer, feeRate?: string) {
        let forkId: BN = new BN(randomBytes(6));

        this.logger.debug("saveNewForkHeaders(): submitting new fork & blockheaders," +
            " count: "+forkHeaders.length+" forkId: 0x"+forkId.toString(16));

        return await this._saveHeaders(signer, forkHeaders, storedHeader, tipWork, forkId.toNumber(), feeRate);
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
    public saveForkHeaders(signer: string, forkHeaders: BtcBlock[], storedHeader: StarknetBtcStoredHeader, forkId: number, tipWork: Buffer, feeRate?: string) {
        this.logger.debug("saveForkHeaders(): submitting blockheaders to existing fork," +
            " count: "+forkHeaders.length+" forkId: 0x"+forkId.toString(16));

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
    public saveShortForkHeaders(signer: string, forkHeaders: BtcBlock[], storedHeader: StarknetBtcStoredHeader, tipWork: Buffer, feeRate?: string) {
        this.logger.debug("saveShortForkHeaders(): submitting short fork blockheaders," +
            " count: "+forkHeaders.length);

        return this._saveHeaders(signer, forkHeaders, storedHeader, tipWork, -1, feeRate);
    }

    /**
     * Estimate required synchronization fee (worst case) to synchronize btc relay to the required blockheight
     *
     * @param requiredBlockheight
     * @param feeRate
     */
    public async estimateSynchronizeFee(requiredBlockheight: number, feeRate?: string): Promise<BN> {
        const tipData = await this.getTipData();
        const currBlockheight = tipData.blockheight;

        const blockheightDelta = requiredBlockheight-currBlockheight;

        if(blockheightDelta<=0) return new BN(0);

        const synchronizationFee = new BN(blockheightDelta).mul(await this.getFeePerBlock(feeRate));
        this.logger.debug("estimateSynchronizeFee(): required blockheight: "+requiredBlockheight+
            " blockheight delta: "+blockheightDelta+" fee: "+synchronizationFee.toString(10));

        return synchronizationFee;
    }

    /**
     * Returns fee required (in SOL) to synchronize a single block to btc relay
     *
     * @param feeRate
     */
    public async getFeePerBlock(feeRate?: string): Promise<BN> {
        return StarknetFees.getGasFee(GAS_PER_BLOCKHEADER, feeRate);
    }

    /**
     * Gets fee rate required for submitting blockheaders to the main chain
     */
    public getMainFeeRate(signer: string | null): Promise<string> {
        return this.Fees.getFeeRate();
    }

    /**
     * Gets fee rate required for submitting blockheaders to the specific fork
     */
    public getForkFeeRate(signer: string, forkId: number): Promise<string> {
        return this.Fees.getFeeRate();
    }

    saveInitialHeader(signer: string, header: B, epochStart: number, pastBlocksTimestamps: number[], feeRate?: string): Promise<StarknetTx> {
        throw new Error("Not supported, starknet contract is initialized with constructor!");
    }

}
