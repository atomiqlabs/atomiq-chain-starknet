"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetSwapContract = void 0;
const base_1 = require("@atomiqlabs/base");
const buffer_1 = require("buffer");
const EscrowManagerAbi_1 = require("./EscrowManagerAbi");
const StarknetContractBase_1 = require("../contract/StarknetContractBase");
const StarknetSigner_1 = require("../wallet/StarknetSigner");
const starknet_1 = require("starknet");
const StarknetFees_1 = require("../base/modules/StarknetFees");
const StarknetSwapData_1 = require("./StarknetSwapData");
const Utils_1 = require("../../utils/Utils");
const TimelockRefundHandler_1 = require("./handlers/refund/TimelockRefundHandler");
const StarknetKeypairWallet_1 = require("../wallet/StarknetKeypairWallet");
const StarknetLpVault_1 = require("./modules/StarknetLpVault");
const StarknetSwapInit_1 = require("./modules/StarknetSwapInit");
const StarknetSwapRefund_1 = require("./modules/StarknetSwapRefund");
const ClaimHandlers_1 = require("./handlers/claim/ClaimHandlers");
const StarknetSwapClaim_1 = require("./modules/StarknetSwapClaim");
const createHash = require("create-hash");
const ESCROW_STATE_COMMITTED = 1;
const ESCROW_STATE_CLAIMED = 2;
const ESCROW_STATE_REFUNDED = 3;
const swapContractAddreses = {
    [starknet_1.constants.StarknetChainId.SN_SEPOLIA]: "0x035e9a06faa09ee78d7c8f4722687e4f3c8d8094860cc5092704b26a50f8a43f",
    [starknet_1.constants.StarknetChainId.SN_MAIN]: "0x00b30f3bf0702d2570036c786a4b329816f99eecf36368cf74da0c0dfd67634d"
};
const defaultClaimAddresses = {
    [starknet_1.constants.StarknetChainId.SN_SEPOLIA]: {
        [base_1.ChainSwapType.HTLC]: "0x04a57ea54d4637c352aad1bbee046868926a11702216a0aaf7eeec1568be2d7b",
        [base_1.ChainSwapType.CHAIN_TXID]: "0x04c7cde88359e14b6f6f779f8b9d8310cee37e91a6f143f855ae29fab33c396e",
        [base_1.ChainSwapType.CHAIN]: "0x051bef6f5fd12e2832a7d38653bdfc8eb84ba7eb7a4aada5b87ef38a9999cf17",
        [base_1.ChainSwapType.CHAIN_NONCED]: "0x050e50eacd16da414f2c3a7c3570fd5e248974c6fe757d41acbf72d2836fa0a1"
    },
    [starknet_1.constants.StarknetChainId.SN_MAIN]: {
        [base_1.ChainSwapType.HTLC]: "0x0421c59a5442ccc430288c71ae606f2ca94dda7c8cd7c101f0865fa264853989",
        [base_1.ChainSwapType.CHAIN_TXID]: "0x03aad3b184fa6484e3f8dde6a45a2c2512460a3fb4893112694b68645b50ce2e",
        [base_1.ChainSwapType.CHAIN]: "0x012a938e57af955a4c96c49900731f572670bf1b7e120f99a7fe7d1f5d75cb8a",
        [base_1.ChainSwapType.CHAIN_NONCED]: "0x04a0cad6b9d9ed790ce3eb95bddc22663168f0d50d24adaf7495b344609874a7"
    }
};
const defaultRefundAddresses = {
    [starknet_1.constants.StarknetChainId.SN_SEPOLIA]: {
        timelock: "0x0726415752e78da4549e09da7824ae20b45539ca1fca71c93b349887cc0cac0d"
    },
    [starknet_1.constants.StarknetChainId.SN_MAIN]: {
        timelock: "0x014ceb49916bb9228d8179db0c480147fab2dab71e17cfd7eca9c214eeb427e2"
    }
};
class StarknetSwapContract extends StarknetContractBase_1.StarknetContractBase {
    constructor(chainId, provider, btcRelay, contractAddress = swapContractAddreses[chainId], retryPolicy, solanaFeeEstimator = new StarknetFees_1.StarknetFees(provider), handlerAddresses) {
        super(chainId, provider, contractAddress, EscrowManagerAbi_1.EscrowManagerAbi, retryPolicy, solanaFeeEstimator);
        ////////////////////////
        //// Constants
        this.chainId = "STARKNET";
        ////////////////////////
        //// Timeouts
        this.claimWithSecretTimeout = 180;
        this.claimWithTxDataTimeout = 180;
        this.refundTimeout = 180;
        this.claimGracePeriod = 10 * 60;
        this.refundGracePeriod = 10 * 60;
        this.authGracePeriod = 30;
        ////////////////////////
        //// Handlers
        this.claimHandlersByAddress = {};
        this.claimHandlersBySwapType = {};
        this.refundHandlersByAddress = {};
        this.Init = new StarknetSwapInit_1.StarknetSwapInit(this);
        this.Refund = new StarknetSwapRefund_1.StarknetSwapRefund(this);
        this.Claim = new StarknetSwapClaim_1.StarknetSwapClaim(this);
        this.LpVault = new StarknetLpVault_1.StarknetLpVault(this);
        this.btcRelay = btcRelay;
        handlerAddresses ?? (handlerAddresses = {});
        handlerAddresses.refund ?? (handlerAddresses.refund = {});
        handlerAddresses.refund = { ...defaultRefundAddresses[chainId], ...handlerAddresses.refund };
        handlerAddresses.claim ?? (handlerAddresses.claim = {});
        handlerAddresses.claim = { ...defaultClaimAddresses[chainId], ...handlerAddresses.claim };
        ClaimHandlers_1.claimHandlersList.forEach(handlerCtor => {
            const handler = new handlerCtor(handlerAddresses.claim[handlerCtor.type]);
            this.claimHandlersByAddress[handler.address] = handler;
            this.claimHandlersBySwapType[handlerCtor.type] = handler;
        });
        this.timelockRefundHandler = new TimelockRefundHandler_1.TimelockRefundHandler(handlerAddresses.refund.timelock);
        this.refundHandlersByAddress[this.timelockRefundHandler.address] = this.timelockRefundHandler;
    }
    async start() {
    }
    ////////////////////////////////////////////
    //// Signatures
    preFetchForInitSignatureVerification() {
        return this.Init.preFetchForInitSignatureVerification();
    }
    getInitSignature(signer, swapData, authorizationTimeout, preFetchedBlockData, feeRate) {
        return this.Init.signSwapInitialization(signer, swapData, authorizationTimeout);
    }
    isValidInitAuthorization(swapData, { timeout, prefix, signature }, feeRate, preFetchedData) {
        return this.Init.isSignatureValid(swapData, timeout, prefix, signature, preFetchedData);
    }
    getInitAuthorizationExpiry(swapData, { timeout, prefix, signature }, preFetchedData) {
        return this.Init.getSignatureExpiry(timeout);
    }
    isInitAuthorizationExpired(swapData, { timeout, prefix, signature }) {
        return this.Init.isSignatureExpired(timeout);
    }
    getRefundSignature(signer, swapData, authorizationTimeout) {
        return this.Refund.signSwapRefund(signer, swapData, authorizationTimeout);
    }
    isValidRefundAuthorization(swapData, { timeout, prefix, signature }) {
        return this.Refund.isSignatureValid(swapData, timeout, prefix, signature);
    }
    getDataSignature(signer, data) {
        return this.Signatures.getDataSignature(signer, data);
    }
    isValidDataSignature(data, signature, publicKey) {
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
    async isClaimable(signer, data) {
        if (!data.isClaimer(signer))
            return false;
        if (await this.isExpired(signer, data))
            return false;
        return await this.isCommited(data);
    }
    /**
     * Checks whether a swap is commited, i.e. the swap still exists on-chain and was not claimed nor refunded
     *
     * @param swapData
     */
    async isCommited(swapData) {
        const data = await this.contract.get_hash_state("0x" + swapData.getEscrowHash());
        return Number(data.state) === ESCROW_STATE_COMMITTED;
    }
    /**
     * Checks whether the swap is expired, takes into consideration possible on-chain time skew, therefore for claimer
     *  the swap expires a bit sooner than it should've & for the offerer it expires a bit later
     *
     * @param signer
     * @param data
     */
    isExpired(signer, data) {
        let currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
        if (data.isClaimer(signer))
            currentTimestamp = currentTimestamp - BigInt(this.refundGracePeriod);
        if (data.isOfferer(signer))
            currentTimestamp = currentTimestamp + BigInt(this.claimGracePeriod);
        return Promise.resolve(data.getExpiry() < currentTimestamp);
    }
    /**
     * Checks if the swap is refundable by us, checks if we are offerer, if the swap is already expired & if the swap
     *  is still commited
     *
     * @param signer
     * @param data
     */
    async isRequestRefundable(signer, data) {
        //Swap can only be refunded by the offerer
        if (!data.isOfferer(signer))
            return false;
        if (!(await this.isExpired(signer, data)))
            return false;
        return await this.isCommited(data);
    }
    getHashForTxId(txId, confirmations) {
        return (0, Utils_1.bigNumberishToBuffer)(this.claimHandlersBySwapType[base_1.ChainSwapType.CHAIN_TXID].getCommitment({
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
    getHashForOnchain(outputScript, amount, confirmations, nonce) {
        let result;
        if (nonce == null || nonce === 0n) {
            result = this.claimHandlersBySwapType[base_1.ChainSwapType.CHAIN].getCommitment({
                output: outputScript,
                amount,
                confirmations,
                btcRelay: this.btcRelay
            });
        }
        else {
            result = this.claimHandlersBySwapType[base_1.ChainSwapType.CHAIN_NONCED].getCommitment({
                output: outputScript,
                amount,
                nonce,
                confirmations,
                btcRelay: this.btcRelay
            });
        }
        return (0, Utils_1.bigNumberishToBuffer)(result, 32);
    }
    /**
     * Get the swap payment hash to be used for a lightning htlc swap, uses poseidon hash of the sha256 hash of the preimage
     *
     * @param paymentHash payment hash of the HTLC
     */
    getHashForHtlc(paymentHash) {
        return (0, Utils_1.bigNumberishToBuffer)(this.claimHandlersBySwapType[base_1.ChainSwapType.HTLC].getCommitment(paymentHash), 32);
    }
    getExtraData(outputScript, amount, confirmations, nonce) {
        if (nonce == null)
            nonce = 0n;
        const txoHash = createHash("sha256").update(buffer_1.Buffer.concat([
            base_1.BigIntBufferUtils.toBuffer(amount, "le", 8),
            outputScript
        ])).digest();
        return buffer_1.Buffer.concat([
            txoHash,
            base_1.BigIntBufferUtils.toBuffer(nonce, "be", 8),
            base_1.BigIntBufferUtils.toBuffer(BigInt(confirmations), "be", 2)
        ]);
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
    async getCommitStatus(signer, data) {
        const escrowHash = data.getEscrowHash();
        const stateData = await this.contract.get_hash_state("0x" + escrowHash);
        const state = Number(stateData.state);
        switch (state) {
            case ESCROW_STATE_COMMITTED:
                if (data.isOfferer(signer) && await this.isExpired(signer, data))
                    return base_1.SwapCommitStatus.REFUNDABLE;
                return base_1.SwapCommitStatus.COMMITED;
            case ESCROW_STATE_CLAIMED:
                return base_1.SwapCommitStatus.PAID;
            default:
                if (await this.isExpired(signer, data))
                    return base_1.SwapCommitStatus.EXPIRED;
                return base_1.SwapCommitStatus.NOT_COMMITED;
        }
    }
    /**
     * Checks the status of the specific payment hash
     *
     * @param paymentHash
     */
    async getPaymentHashStatus(paymentHash) {
        //TODO: Noop
        return base_1.SwapCommitStatus.NOT_COMMITED;
    }
    /**
     * Returns the data committed for a specific payment hash, or null if no data is currently commited for
     *  the specific swap
     *
     * @param paymentHashHex
     */
    async getCommitedData(paymentHashHex) {
        //TODO: Noop
        return null;
    }
    ////////////////////////////////////////////
    //// Swap data initializer
    createSwapData(type, offerer, claimer, token, amount, paymentHash, sequence, expiry, payIn, payOut, securityDeposit, claimerBounty, depositToken = this.Tokens.getNativeCurrencyAddress()) {
        return Promise.resolve(new StarknetSwapData_1.StarknetSwapData(offerer, claimer, token, this.timelockRefundHandler.address, this.claimHandlersBySwapType?.[type]?.address, payOut, payIn, payIn, //For now track reputation for all payIn swaps
        sequence, "0x" + paymentHash, (0, Utils_1.toHex)(expiry), amount, depositToken, securityDeposit, claimerBounty, type, null, []));
    }
    ////////////////////////////////////////////
    //// Utils
    async getBalance(signer, tokenAddress, inContract) {
        if (inContract)
            return await this.getIntermediaryBalance(signer, tokenAddress);
        //TODO: For native token we should discount the cost of deploying an account if it is not deployed yet
        return await this.Tokens.getTokenBalance(signer, tokenAddress);
    }
    getIntermediaryData(address, token) {
        return this.LpVault.getIntermediaryData(address, token);
    }
    getIntermediaryReputation(address, token) {
        return this.LpVault.getIntermediaryReputation(address, token);
    }
    getIntermediaryBalance(address, token) {
        return this.LpVault.getIntermediaryBalance(address, token);
    }
    isValidAddress(address) {
        return this.Addresses.isValidAddress(address);
    }
    getNativeCurrencyAddress() {
        return this.Tokens.getNativeCurrencyAddress();
    }
    ////////////////////////////////////////////
    //// Transaction initializers
    async txsClaimWithSecret(signer, swapData, secret, checkExpiry, initAta, feeRate, skipAtaCheck) {
        return this.Claim.txsClaimWithSecret(typeof (signer) === "string" ? signer : signer.getAddress(), swapData, secret, checkExpiry, feeRate);
    }
    async txsClaimWithTxData(signer, swapData, tx, requiredConfirmations, vout, commitedHeader, synchronizer, initAta, feeRate) {
        return this.Claim.txsClaimWithTxData(typeof (signer) === "string" ? signer : signer.getAddress(), swapData, tx, requiredConfirmations, vout, commitedHeader, synchronizer, feeRate);
    }
    txsRefund(swapData, check, initAta, feeRate) {
        return this.Refund.txsRefund(swapData, check, feeRate);
    }
    txsRefundWithAuthorization(swapData, { timeout, prefix, signature }, check, initAta, feeRate) {
        return this.Refund.txsRefundWithAuthorization(swapData, timeout, prefix, signature, check, feeRate);
    }
    txsInit(swapData, { timeout, prefix, signature }, skipChecks, feeRate) {
        return this.Init.txsInit(swapData, timeout, prefix, signature, skipChecks, feeRate);
    }
    txsWithdraw(signer, token, amount, feeRate) {
        return this.LpVault.txsWithdraw(signer, token, amount, feeRate);
    }
    txsDeposit(signer, token, amount, feeRate) {
        return this.LpVault.txsDeposit(signer, token, amount, feeRate);
    }
    txsTransfer(signer, token, amount, dstAddress, feeRate) {
        return this.Tokens.txsTransfer(signer, token, amount, dstAddress, feeRate);
    }
    ////////////////////////////////////////////
    //// Executors
    async claimWithSecret(signer, swapData, secret, checkExpiry, initAta, txOptions) {
        const result = await this.Claim.txsClaimWithSecret(signer.getAddress(), swapData, secret, checkExpiry, txOptions?.feeRate);
        const [signature] = await this.Transactions.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return signature;
    }
    async claimWithTxData(signer, swapData, tx, requiredConfirmations, vout, commitedHeader, synchronizer, initAta, txOptions) {
        const txs = await this.Claim.txsClaimWithTxData(signer.getAddress(), swapData, tx, requiredConfirmations, vout, commitedHeader, synchronizer, txOptions?.feeRate);
        if (txs === null)
            throw new Error("Btc relay not synchronized to required blockheight!");
        //TODO: This doesn't return proper tx signature
        const [signature] = await this.Transactions.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return signature;
    }
    async refund(signer, swapData, check, initAta, txOptions) {
        if (!swapData.isOfferer(signer.getAddress()))
            throw new Error("Invalid signer provided!");
        let result = await this.txsRefund(swapData, check, initAta, txOptions?.feeRate);
        const [signature] = await this.Transactions.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return signature;
    }
    async refundWithAuthorization(signer, swapData, signature, check, initAta, txOptions) {
        if (!swapData.isOfferer(signer.getAddress()))
            throw new Error("Invalid signer provided!");
        let result = await this.txsRefundWithAuthorization(swapData, signature, check, initAta, txOptions?.feeRate);
        const [txSignature] = await this.Transactions.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return txSignature;
    }
    async init(signer, swapData, signature, skipChecks, txOptions) {
        if (swapData.isPayIn()) {
            if (!swapData.isOfferer(signer.getAddress()))
                throw new Error("Invalid signer provided!");
        }
        else {
            if (!swapData.isClaimer(signer.getAddress()))
                throw new Error("Invalid signer provided!");
        }
        let result = await this.txsInit(swapData, signature, skipChecks, txOptions?.feeRate);
        const [txSignature] = await this.Transactions.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return txSignature;
    }
    async withdraw(signer, token, amount, txOptions) {
        const txs = await this.LpVault.txsWithdraw(signer.getAddress(), token, amount, txOptions?.feeRate);
        const [txId] = await this.Transactions.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal, false);
        return txId;
    }
    async deposit(signer, token, amount, txOptions) {
        const txs = await this.LpVault.txsDeposit(signer.getAddress(), token, amount, txOptions?.feeRate);
        const [txId] = await this.Transactions.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal, false);
        return txId;
    }
    async transfer(signer, token, amount, dstAddress, txOptions) {
        const txs = await this.Tokens.txsTransfer(signer.getAddress(), token, amount, dstAddress, txOptions?.feeRate);
        const [txId] = await this.Transactions.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal, false);
        return txId;
    }
    ////////////////////////////////////////////
    //// Transactions
    sendAndConfirm(signer, txs, waitForConfirmation, abortSignal, parallel, onBeforePublish) {
        return this.Transactions.sendAndConfirm(signer, txs, waitForConfirmation, abortSignal, parallel, onBeforePublish);
    }
    serializeTx(tx) {
        return this.Transactions.serializeTx(tx);
    }
    deserializeTx(txData) {
        return this.Transactions.deserializeTx(txData);
    }
    getTxIdStatus(txId) {
        return this.Transactions.getTxIdStatus(txId);
    }
    getTxStatus(tx) {
        return this.Transactions.getTxStatus(tx);
    }
    ////////////////////////////////////////////
    //// Fees
    getInitPayInFeeRate(offerer, claimer, token, paymentHash) {
        return this.Fees.getFeeRate();
    }
    getInitFeeRate(offerer, claimer, token, paymentHash) {
        return this.Fees.getFeeRate();
    }
    getRefundFeeRate(swapData) {
        return this.Fees.getFeeRate();
    }
    getClaimFeeRate(signer, swapData) {
        return this.Fees.getFeeRate();
    }
    getClaimFee(signer, swapData, feeRate) {
        return this.Claim.getClaimFee(swapData, feeRate);
    }
    /**
     * Get the estimated solana fee of the commit transaction
     */
    getCommitFee(swapData, feeRate) {
        return this.Init.getInitFee(swapData, feeRate);
    }
    /**
     * Get the estimated solana transaction fee of the refund transaction
     */
    getRefundFee(swapData, feeRate) {
        return this.Refund.getRefundFee(swapData, feeRate);
    }
    ///////////////////////////////////
    //// Callbacks & handlers
    offBeforeTxReplace(callback) {
        return true;
    }
    onBeforeTxReplace(callback) { }
    onBeforeTxSigned(callback) {
        this.Transactions.onBeforeTxSigned(callback);
    }
    offBeforeTxSigned(callback) {
        return this.Transactions.offBeforeTxSigned(callback);
    }
    isValidToken(tokenIdentifier) {
        return this.Tokens.isValidToken(tokenIdentifier);
    }
    randomAddress() {
        return starknet_1.stark.randomAddress();
    }
    randomSigner() {
        const privateKey = "0x" + buffer_1.Buffer.from(starknet_1.ec.starkCurve.utils.randomPrivateKey()).toString("hex");
        const wallet = new StarknetKeypairWallet_1.StarknetKeypairWallet(this.provider, privateKey);
        return new StarknetSigner_1.StarknetSigner(wallet);
    }
}
exports.StarknetSwapContract = StarknetSwapContract;
