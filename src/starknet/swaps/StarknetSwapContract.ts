import * as BN from "bn.js";
import {
    ChainSwapType,
    IntermediaryReputationType,
    RelaySynchronizer,
    SignatureData,
    SwapCommitStatus,
    SwapContract,
    TransactionConfirmationOptions
} from "@atomiqlabs/base";
import {Buffer} from "buffer";
import {EscrowManagerAbi} from "./EscrowManagerAbi";
import {StarknetContractBase} from "../contract/StarknetContractBase";
import {StarknetTx} from "../base/modules/StarknetTransactions";
import {StarknetSigner} from "../wallet/StarknetSigner";
import {BigNumberish, constants, ec, hash, Provider, stark} from "starknet";
import {StarknetRetryPolicy} from "../base/StarknetBase";
import {StarknetFees} from "../base/modules/StarknetFees";
import {StarknetBtcRelay} from "../btcrelay/StarknetBtcRelay";
import {StarknetSwapData} from "./StarknetSwapData";
import {bigNumberishToBuffer, bufferToU32Array, poseidonHashRange, toBigInt, toHex} from "../../utils/Utils";
import {TimelockRefundHandler} from "./handlers/refund/TimelockRefundHandler";
import {StarknetKeypairWallet} from "../wallet/StarknetKeypairWallet";
import {StarknetLpVault} from "./modules/SolanaLpVault";
import {SwapInit} from "./modules/SwapInit";
import {SwapRefund} from "./modules/SwapRefund";
import {claimHandlersBySwapType, claimHandlersList, IClaimHandler} from "./handlers/claim/ClaimHandlers";
import {SwapClaim} from "./modules/SwapClaim";
import {IHandler} from "./handlers/IHandler";

const ESCROW_STATE_COMMITTED = 1;
const ESCROW_STATE_CLAIMED = 2;
const ESCROW_STATE_REFUNDED = 3;

export class StarknetSwapContract
    extends StarknetContractBase<typeof EscrowManagerAbi>
    implements SwapContract<
        StarknetSwapData,
        StarknetTx,
        never,
        never,
        StarknetSigner,
        "STARKNET"
    > {

    ////////////////////////
    //// Constants
    readonly chainId: "STARKNET" = "STARKNET";

    ////////////////////////
    //// Timeouts
    readonly claimWithSecretTimeout: number = 180;
    readonly claimWithTxDataTimeout: number = 180;
    readonly refundTimeout: number = 180;
    readonly claimGracePeriod: number = 10*60;
    readonly refundGracePeriod: number = 10*60;
    readonly authGracePeriod: number = 30;

    ////////////////////////
    //// Services
    readonly Init: SwapInit;
    readonly Refund: SwapRefund;
    readonly Claim: SwapClaim;
    readonly LpVault: StarknetLpVault;

    ////////////////////////
    //// Handlers
    readonly claimHandlersByAddress: {[address: string]: IClaimHandler<any, any>} = {};
    readonly claimHandlersBySwapType: {[type in ChainSwapType]?: IClaimHandler<any, any>} = {};

    readonly refundHandlersByAddress: {[address: string]: IHandler<any, any>} = {};

    readonly btcRelay: StarknetBtcRelay<any>;

    constructor(
        chainId: constants.StarknetChainId,
        provider: Provider,
        contractAddress: string,
        btcRelay: StarknetBtcRelay<any>,
        retryPolicy?: StarknetRetryPolicy,
        solanaFeeEstimator: StarknetFees = new StarknetFees(provider)
    ) {
        super(chainId, provider, contractAddress, EscrowManagerAbi, retryPolicy, solanaFeeEstimator);
        this.Init = new SwapInit(this);
        this.Refund = new SwapRefund(this);
        this.Claim = new SwapClaim(this);
        this.LpVault = new StarknetLpVault(this);

        this.btcRelay = btcRelay;

        claimHandlersList.forEach(handlerCtor => {
            const handler = new handlerCtor();
            this.claimHandlersByAddress[handlerCtor.address.toLowerCase()] = handler;
            this.claimHandlersBySwapType[handlerCtor.type] = handler;
        });

        this.refundHandlersByAddress[TimelockRefundHandler.address.toLowerCase()] = new TimelockRefundHandler();
    }

    async start(): Promise<void> {
    }

    ////////////////////////////////////////////
    //// Signatures
    getInitSignature(signer: StarknetSigner, swapData: StarknetSwapData, authorizationTimeout: number, preFetchedBlockData?: never, feeRate?: string): Promise<SignatureData> {
        return this.Init.signSwapInitialization(signer, swapData, authorizationTimeout);
    }

    isValidInitAuthorization(swapData: StarknetSwapData, {timeout, prefix, signature}, feeRate?: string, preFetchedData?: never): Promise<Buffer> {
        return this.Init.isSignatureValid(swapData, timeout, prefix, signature);
    }

    getInitAuthorizationExpiry(swapData: StarknetSwapData, {timeout, prefix, signature}, preFetchedData?: never): Promise<number> {
        return this.Init.getSignatureExpiry(timeout);
    }

    isInitAuthorizationExpired(swapData: StarknetSwapData, {timeout, prefix, signature}): Promise<boolean> {
        return this.Init.isSignatureExpired(timeout);
    }

    getRefundSignature(signer: StarknetSigner, swapData: StarknetSwapData, authorizationTimeout: number): Promise<SignatureData> {
        return this.Refund.signSwapRefund(signer, swapData, authorizationTimeout);
    }

    isValidRefundAuthorization(swapData: StarknetSwapData, {timeout, prefix, signature}): Promise<Buffer> {
        return this.Refund.isSignatureValid(swapData, timeout, prefix, signature);
    }

    getDataSignature(signer: StarknetSigner, data: Buffer): Promise<string> {
        return this.Signatures.getDataSignature(signer, data);
    }

    isValidDataSignature(data: Buffer, signature: string, publicKey: string): Promise<boolean> {
        return this.Signatures.isValidDataSignature(data, signature, publicKey);
    }

    ////////////////////////////////////////////
    //// Swap data utils
    /**
     * Checks whether the claim is claimable by us, that means not expired, we are claimer & the swap is commited
     *
     * @param signer
     * @param data
     */
    isClaimable(signer: string, data: StarknetSwapData): Promise<boolean> {
        if(!data.isClaimer(signer)) return Promise.resolve(false);
        if(this.isExpired(signer, data)) return Promise.resolve(false);
        return this.isCommited(data);
    }

    /**
     * Checks whether a swap is commited, i.e. the swap still exists on-chain and was not claimed nor refunded
     *
     * @param swapData
     */
    async isCommited(swapData: StarknetSwapData): Promise<boolean> {
        const commitmentHash = swapData.getEscrowHash();
        const data = await this.contract.get_hash_state(toHex(commitmentHash));
        return Number(data.state)===ESCROW_STATE_COMMITTED;
    }

    /**
     * Checks whether the swap is expired, takes into consideration possible on-chain time skew, therefore for claimer
     *  the swap expires a bit sooner than it should've & for the offerer it expires a bit later
     *
     * @param signer
     * @param data
     */
    isExpired(signer: string, data: StarknetSwapData): boolean {
        let currentTimestamp: BN = new BN(Math.floor(Date.now()/1000));
        if(data.isClaimer(signer)) currentTimestamp = currentTimestamp.sub(new BN(this.refundGracePeriod));
        if(data.isOfferer(signer)) currentTimestamp = currentTimestamp.add(new BN(this.claimGracePeriod));
        return data.getExpiry().lt(currentTimestamp);
    }

    /**
     * Checks if the swap is refundable by us, checks if we are offerer, if the swap is already expired & if the swap
     *  is still commited
     *
     * @param signer
     * @param data
     */
    isRequestRefundable(signer: string, data: StarknetSwapData): Promise<boolean> {
        //Swap can only be refunded by the offerer
        if(!data.isOfferer(signer)) return Promise.resolve(false);
        if(!this.isExpired(signer, data)) return Promise.resolve(false);
        return this.isCommited(data);
    }

    getHashForTxId(txId: string, confirmations: number) {
        return bigNumberishToBuffer(this.claimHandlersBySwapType[ChainSwapType.CHAIN_TXID].getCommitment({
            txId,
            confirmations,
            btcRelay: this.btcRelay
        }), 32);
    }

    /**
     * Get the swap payment hash to be used for an on-chain swap, uses poseidon hash of the value
     *
     * @param outputScript output script required to claim the swap
     * @param amount sats sent required to claim the swap
     * @param confirmations
     * @param nonce swap nonce uniquely identifying the transaction to prevent replay attacks
     */
    getHashForOnchain(outputScript: Buffer, amount: BN, confirmations: number, nonce?: BN): Buffer {
        let result: BigNumberish;
        if(nonce==null || nonce.isZero()) {
            result = this.claimHandlersBySwapType[ChainSwapType.CHAIN].getCommitment({
                output: outputScript,
                amount,
                confirmations,
                btcRelay: this.btcRelay
            });
        } else {
            result = this.claimHandlersBySwapType[ChainSwapType.CHAIN_NONCED].getCommitment({
                output: outputScript,
                amount,
                nonce,
                confirmations,
                btcRelay: this.btcRelay
            });
        }
        return bigNumberishToBuffer(result, 32);
    }

    /**
     * Get the swap payment hash to be used for a lightning htlc swap, uses poseidon hash of the sha256 hash of the preimage
     *
     * @param paymentHash payment hash of the HTLC
     */
    getHashForHtlc(paymentHash: Buffer): Buffer {
        return bigNumberishToBuffer(this.claimHandlersBySwapType[ChainSwapType.HTLC].getCommitment(paymentHash), 32);
    }

    ////////////////////////////////////////////
    //// Swap data getters
    /**
     * Gets the status of the specific swap, this also checks if we are offerer/claimer & checks for expiry (to see
     *  if swap is refundable)
     *
     * @param signer
     * @param data
     */
    async getCommitStatus(signer: string, data: StarknetSwapData): Promise<SwapCommitStatus> {
        const stateData = await this.contract.get_hash_state(toHex(data.getEscrowHash()));
        const state = Number(stateData.state);
        switch(state) {
            case ESCROW_STATE_COMMITTED:
                if(data.isOfferer(signer) && this.isExpired(signer,data)) return SwapCommitStatus.REFUNDABLE;
                return SwapCommitStatus.COMMITED;
            case ESCROW_STATE_CLAIMED:
                return SwapCommitStatus.PAID;
            default:
                if(this.isExpired(signer, data)) return SwapCommitStatus.EXPIRED;
                return SwapCommitStatus.NOT_COMMITED;
        }
    }

    /**
     * Checks the status of the specific payment hash
     *
     * @param paymentHash
     */
    async getPaymentHashStatus(paymentHash: string): Promise<SwapCommitStatus> {
        //TODO: Noop
        return SwapCommitStatus.NOT_COMMITED;
    }

    /**
     * Returns the data committed for a specific payment hash, or null if no data is currently commited for
     *  the specific swap
     *
     * @param paymentHashHex
     */
    async getCommitedData(paymentHashHex: string): Promise<StarknetSwapData> {
        //TODO: Noop
        return null;
    }

    ////////////////////////////////////////////
    //// Swap data initializer
    createSwapData(
        type: ChainSwapType,
        offerer: string,
        claimer: string,
        token: string,
        amount: BN,
        paymentHash: string,
        sequence: BN,
        expiry: BN,
        escrowNonce: BN,
        confirmations: number,
        payIn: boolean,
        payOut: boolean,
        securityDeposit: BN,
        claimerBounty: BN
    ): Promise<StarknetSwapData> {
        return Promise.resolve(new StarknetSwapData(
            offerer,
            claimer,
            token,
            TimelockRefundHandler.address,
            claimHandlersBySwapType?.[type]?.address,
            payOut,
            payIn,
            !payIn, //For now track reputation for all non payIn swaps
            sequence,
            toHex(paymentHash),
            toHex(expiry),
            amount,
            this.Tokens.getNativeCurrencyAddress(),
            securityDeposit,
            claimerBounty,
            null
        ));
    }

    ////////////////////////////////////////////
    //// Utils
    async getBalance(signer: string, tokenAddress: string, inContract: boolean): Promise<BN> {
        if(inContract) return await this.getIntermediaryBalance(signer, tokenAddress);

        //TODO: For native token we should discount the cost of deploying an account if it is not deployed yet
        return await this.Tokens.getTokenBalance(signer, tokenAddress);
    }

    getIntermediaryData(address: string, token: string): Promise<{
        balance: BN,
        reputation: IntermediaryReputationType
    }> {
        return this.LpVault.getIntermediaryData(address, token);
    }

    getIntermediaryReputation(address: string, token: string): Promise<IntermediaryReputationType> {
        return this.LpVault.getIntermediaryReputation(address, token);
    }

    getIntermediaryBalance(address: string, token: string): Promise<BN> {
        return this.LpVault.getIntermediaryBalance(address, token);
    }

    isValidAddress(address: string): boolean {
        return this.Addresses.isValidAddress(address);
    }

    getNativeCurrencyAddress(): string {
        return this.Tokens.getNativeCurrencyAddress();
    }

    ////////////////////////////////////////////
    //// Transaction initializers
    async txsClaimWithSecret(
        signer: string | SolanaSigner,
        swapData: SolanaSwapData,
        secret: string,
        checkExpiry?: boolean,
        initAta?: boolean,
        feeRate?: string,
        skipAtaCheck?: boolean
    ): Promise<SolanaTx[]> {
        return this.Claim.txsClaimWithSecret(typeof(signer)==="string" ? new PublicKey(signer) : signer.getPublicKey(), swapData, secret, checkExpiry, initAta, feeRate, skipAtaCheck)
    }

    async txsClaimWithTxData(
        signer: string | SolanaSigner,
        swapData: SolanaSwapData,
        blockheight: number,
        tx: { blockhash: string, confirmations: number, txid: string, hex: string },
        vout: number,
        commitedHeader?: SolanaBtcStoredHeader,
        synchronizer?: RelaySynchronizer<any, SolanaTx, any>,
        initAta?: boolean,
        feeRate?: string,
        storageAccHolder?: {storageAcc: PublicKey}
    ): Promise<SolanaTx[] | null> {
        return this.Claim.txsClaimWithTxData(typeof(signer)==="string" ? new PublicKey(signer) : signer, swapData, blockheight, tx, vout, commitedHeader, synchronizer, initAta, storageAccHolder, feeRate);
    }

    txsRefund(swapData: StarknetSwapData, check?: boolean, initAta?: boolean, feeRate?: string): Promise<StarknetTx[]> {
        return this.Refund.txsRefund(swapData, check, feeRate);
    }

    txsRefundWithAuthorization(swapData: StarknetSwapData, {timeout, prefix, signature}, check?: boolean, initAta?: boolean, feeRate?: string): Promise<StarknetTx[]> {
        return this.Refund.txsRefundWithAuthorization(swapData, timeout, prefix,signature, check, feeRate);
    }

    txsInitPayIn(swapData: StarknetSwapData, {timeout, prefix, signature}, skipChecks?: boolean, feeRate?: string): Promise<StarknetTx[]> {
        return this.Init.txsInit(swapData, timeout, prefix, signature, skipChecks, feeRate);
    }

    txsInit(swapData: StarknetSwapData, {timeout, prefix, signature}, txoHash?: Buffer, skipChecks?: boolean, feeRate?: string): Promise<StarknetTx[]> {
        return this.Init.txsInit(swapData, timeout, prefix, signature, skipChecks, feeRate);
    }

    txsWithdraw(signer: string, token: string, amount: BN, feeRate?: string): Promise<StarknetTx[]> {
        return this.LpVault.txsWithdraw(signer, token, amount, feeRate);
    }

    txsDeposit(signer: string, token: string, amount: BN, feeRate?: string): Promise<StarknetTx[]> {
        return this.LpVault.txsDeposit(signer, token, amount, feeRate);
    }

    txsTransfer(signer: string, token: string, amount: BN, dstAddress: string, feeRate?: string): Promise<StarknetTx[]> {
        return this.Tokens.txsTransfer(signer, token, amount, dstAddress, feeRate);
    }

    ////////////////////////////////////////////
    //// Executors
    async claimWithSecret(
        signer: SolanaSigner,
        swapData: SolanaSwapData,
        secret: string,
        checkExpiry?: boolean,
        initAta?: boolean,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        const result = await this.Claim.txsClaimWithSecret(signer.getPublicKey(), swapData, secret, checkExpiry, initAta, txOptions?.feeRate);
        const [signature] = await this.Transactions.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return signature;
    }

    async claimWithTxData(
        signer: SolanaSigner,
        swapData: SolanaSwapData,
        blockheight: number,
        tx: { blockhash: string, confirmations: number, txid: string, hex: string },
        vout: number,
        commitedHeader?: SolanaBtcStoredHeader,
        synchronizer?: RelaySynchronizer<any, SolanaTx, any>,
        initAta?: boolean,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        const data: {storageAcc: PublicKey} = {
            storageAcc: null
        };

        const txs = await this.Claim.txsClaimWithTxData(
            signer, swapData, blockheight, tx, vout,
            commitedHeader, synchronizer, initAta, data, txOptions?.feeRate
        );
        if(txs===null) throw new Error("Btc relay not synchronized to required blockheight!");

        //TODO: This doesn't return proper tx signature
        const [signature] = await this.Transactions.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        await this.DataAccount.removeDataAccount(data.storageAcc);

        return signature;
    }

    async refund(
        signer: StarknetSigner,
        swapData: StarknetSwapData,
        check?: boolean,
        initAta?: boolean,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        if(!swapData.isOfferer(signer.getAddress())) throw new Error("Invalid signer provided!");

        let result = await this.txsRefund(swapData, check, initAta, txOptions?.feeRate);

        const [signature] = await this.Transactions.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);

        return signature;
    }

    async refundWithAuthorization(
        signer: StarknetSigner,
        swapData: StarknetSwapData,
        signature: SignatureData,
        check?: boolean,
        initAta?: boolean,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        if(!swapData.isOfferer(signer.getAddress())) throw new Error("Invalid signer provided!");

        let result = await this.txsRefundWithAuthorization(swapData, signature, check, initAta, txOptions?.feeRate);

        const [txSignature] = await this.Transactions.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);

        return txSignature;
    }

    async initPayIn(
        signer: StarknetSigner,
        swapData: StarknetSwapData,
        signature: SignatureData,
        skipChecks?: boolean,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        if(!swapData.isOfferer(signer.getAddress())) throw new Error("Invalid signer provided!");

        let result = await this.txsInitPayIn(swapData, signature, skipChecks, txOptions?.feeRate);

        const signatures = await this.Transactions.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);

        return signatures[signatures.length-1];
    }

    async init(
        signer: StarknetSigner,
        swapData: StarknetSwapData,
        signature: SignatureData,
        txoHash?: Buffer,
        skipChecks?: boolean,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        if(!swapData.isClaimer(signer.getAddress())) throw new Error("Invalid signer provided!");

        let result = await this.txsInit(swapData, signature, txoHash, skipChecks, txOptions?.feeRate);

        const [txSignature] = await this.Transactions.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);

        return txSignature;
    }

    async initAndClaimWithSecret(
        signer: StarknetSigner,
        swapData: StarknetSwapData,
        signature: SignatureData,
        secret: string,
        skipChecks?: boolean,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string[]> {
        if(!swapData.isClaimer(signer.getAddress())) throw new Error("Invalid signer provided!");

        const txsCommit = await this.txsInit(swapData, signature, null, skipChecks, txOptions?.feeRate);
        const txsClaim = await this.Claim.txsClaimWithSecret(signer.getAddress(), swapData, secret, true, txOptions?.feeRate);

        return await this.Transactions.sendAndConfirm(signer, txsCommit.concat(txsClaim), txOptions?.waitForConfirmation, txOptions?.abortSignal);
    }

    async withdraw(
        signer: StarknetSigner,
        token: string,
        amount: BN,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        const txs = await this.LpVault.txsWithdraw(signer.getAddress(), token, amount, txOptions?.feeRate);
        const [txId] = await this.Transactions.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal, false);
        return txId;
    }

    async deposit(
        signer: StarknetSigner,
        token: string,
        amount: BN,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        const txs = await this.LpVault.txsDeposit(signer.getAddress(), token, amount, txOptions?.feeRate);
        const [txId] = await this.Transactions.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal, false);
        return txId;
    }

    async transfer(
        signer: StarknetSigner,
        token: string,
        amount: BN,
        dstAddress: string,
        txOptions?: TransactionConfirmationOptions
    ): Promise<string> {
        const txs = await this.Tokens.txsTransfer(signer.getAddress(), token, amount, dstAddress, txOptions?.feeRate);
        const [txId] = await this.Transactions.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal, false);
        return txId;
    }

    ////////////////////////////////////////////
    //// Transactions
    sendAndConfirm(
        signer: StarknetSigner,
        txs: StarknetTx[],
        waitForConfirmation?: boolean,
        abortSignal?: AbortSignal,
        parallel?: boolean,
        onBeforePublish?: (txId: string, rawTx: string) => Promise<void>
    ): Promise<string[]> {
        return this.Transactions.sendAndConfirm(signer, txs, waitForConfirmation, abortSignal, parallel, onBeforePublish);
    }

    serializeTx(tx: StarknetTx): Promise<string> {
        return this.Transactions.serializeTx(tx);
    }

    deserializeTx(txData: string): Promise<StarknetTx> {
        return this.Transactions.deserializeTx(txData);
    }

    getTxIdStatus(txId: string): Promise<"not_found" | "pending" | "success" | "reverted"> {
        return this.Transactions.getTxIdStatus(txId);
    }

    getTxStatus(tx: string): Promise<"not_found" | "pending" | "success" | "reverted"> {
        return this.Transactions.getTxStatus(tx);
    }

    ////////////////////////////////////////////
    //// Fees
    getInitPayInFeeRate(offerer?: string, claimer?: string, token?: string, paymentHash?: string): Promise<string> {
        return this.Fees.getFeeRate();
    }

    getInitFeeRate(offerer?: string, claimer?: string, token?: string, paymentHash?: string): Promise<string> {
        return this.Fees.getFeeRate();
    }

    getRefundFeeRate(swapData: StarknetSwapData): Promise<string> {
        return this.Fees.getFeeRate();
    }

    getClaimFeeRate(signer: string, swapData: StarknetSwapData): Promise<string> {
        return this.Fees.getFeeRate();
    }

    getClaimFee(signer: string, swapData: StarknetSwapData, feeRate?: string): Promise<BN> {
        return this.Claim.getClaimFee(swapData, feeRate);
    }

    /**
     * Get the estimated solana fee of the commit transaction
     */
    getCommitFee(swapData: StarknetSwapData, feeRate?: string): Promise<BN> {
        return this.Init.getInitFee(swapData, feeRate);
    }

    /**
     * Get the estimated solana transaction fee of the refund transaction
     */
    getRefundFee(swapData: StarknetSwapData, feeRate?: string): Promise<BN> {
        return this.Refund.getRefundFee(swapData, feeRate);
    }

    ///////////////////////////////////
    //// Callbacks & handlers
    offBeforeTxReplace(callback: (oldTx: string, oldTxId: string, newTx: string, newTxId: string) => Promise<void>): boolean {
        return true;
    }

    onBeforeTxReplace(callback: (oldTx: string, oldTxId: string, newTx: string, newTxId: string) => Promise<void>): void {}

    onBeforeTxSigned(callback: (tx: StarknetTx) => Promise<void>): void {
        this.Transactions.onBeforeTxSigned(callback);
    }

    offBeforeTxSigned(callback: (tx: StarknetTx) => Promise<void>): boolean {
        return this.Transactions.offBeforeTxSigned(callback);
    }

    isValidToken(tokenIdentifier: string): boolean {
        return this.Tokens.isValidToken(tokenIdentifier);
    }

    randomAddress(): string {
        return stark.randomAddress();
    }

    randomSigner(): StarknetSigner {
        const privateKey = Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex");
        const wallet = new StarknetKeypairWallet(this.provider, privateKey);
        return new StarknetSigner(wallet);
    }

}
