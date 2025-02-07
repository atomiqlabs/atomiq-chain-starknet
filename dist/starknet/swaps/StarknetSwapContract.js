"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetSwapContract = void 0;
const BN = require("bn.js");
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
const SolanaLpVault_1 = require("./modules/SolanaLpVault");
const SwapInit_1 = require("./modules/SwapInit");
const SwapRefund_1 = require("./modules/SwapRefund");
const ClaimHandlers_1 = require("./handlers/claim/ClaimHandlers");
const SwapClaim_1 = require("./modules/SwapClaim");
const ESCROW_STATE_COMMITTED = 1;
const ESCROW_STATE_CLAIMED = 2;
const ESCROW_STATE_REFUNDED = 3;
class StarknetSwapContract extends StarknetContractBase_1.StarknetContractBase {
    constructor(chainId, provider, contractAddress, btcRelay, retryPolicy, solanaFeeEstimator = new StarknetFees_1.StarknetFees(provider)) {
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
        this.Init = new SwapInit_1.SwapInit(this);
        this.Refund = new SwapRefund_1.SwapRefund(this);
        this.Claim = new SwapClaim_1.SwapClaim(this);
        this.LpVault = new SolanaLpVault_1.StarknetLpVault(this);
        this.btcRelay = btcRelay;
        ClaimHandlers_1.claimHandlersList.forEach(handlerCtor => {
            const handler = new handlerCtor();
            this.claimHandlersByAddress[handlerCtor.address.toLowerCase()] = handler;
            this.claimHandlersBySwapType[handlerCtor.type] = handler;
        });
        this.refundHandlersByAddress[TimelockRefundHandler_1.TimelockRefundHandler.address.toLowerCase()] = new TimelockRefundHandler_1.TimelockRefundHandler();
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    ////////////////////////////////////////////
    //// Signatures
    getInitSignature(signer, swapData, authorizationTimeout, preFetchedBlockData, feeRate) {
        return this.Init.signSwapInitialization(signer, swapData, authorizationTimeout);
    }
    isValidInitAuthorization(swapData, { timeout, prefix, signature }, feeRate, preFetchedData) {
        return this.Init.isSignatureValid(swapData, timeout, prefix, signature);
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
    isClaimable(signer, data) {
        if (!data.isClaimer(signer))
            return Promise.resolve(false);
        if (this.isExpired(signer, data))
            return Promise.resolve(false);
        return this.isCommited(data);
    }
    /**
     * Checks whether a swap is commited, i.e. the swap still exists on-chain and was not claimed nor refunded
     *
     * @param swapData
     */
    isCommited(swapData) {
        return __awaiter(this, void 0, void 0, function* () {
            const commitmentHash = swapData.getEscrowHash();
            const data = yield this.contract.get_hash_state((0, Utils_1.toHex)(commitmentHash));
            return Number(data.state) === ESCROW_STATE_COMMITTED;
        });
    }
    /**
     * Checks whether the swap is expired, takes into consideration possible on-chain time skew, therefore for claimer
     *  the swap expires a bit sooner than it should've & for the offerer it expires a bit later
     *
     * @param signer
     * @param data
     */
    isExpired(signer, data) {
        let currentTimestamp = new BN(Math.floor(Date.now() / 1000));
        if (data.isClaimer(signer))
            currentTimestamp = currentTimestamp.sub(new BN(this.refundGracePeriod));
        if (data.isOfferer(signer))
            currentTimestamp = currentTimestamp.add(new BN(this.claimGracePeriod));
        return data.getExpiry().lt(currentTimestamp);
    }
    /**
     * Checks if the swap is refundable by us, checks if we are offerer, if the swap is already expired & if the swap
     *  is still commited
     *
     * @param signer
     * @param data
     */
    isRequestRefundable(signer, data) {
        //Swap can only be refunded by the offerer
        if (!data.isOfferer(signer))
            return Promise.resolve(false);
        if (!this.isExpired(signer, data))
            return Promise.resolve(false);
        return this.isCommited(data);
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
        if (nonce == null || nonce.isZero()) {
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
    ////////////////////////////////////////////
    //// Swap data getters
    /**
     * Gets the status of the specific swap, this also checks if we are offerer/claimer & checks for expiry (to see
     *  if swap is refundable)
     *
     * @param signer
     * @param data
     */
    getCommitStatus(signer, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const stateData = yield this.contract.get_hash_state((0, Utils_1.toHex)(data.getEscrowHash()));
            const state = Number(stateData.state);
            switch (state) {
                case ESCROW_STATE_COMMITTED:
                    if (data.isOfferer(signer) && this.isExpired(signer, data))
                        return base_1.SwapCommitStatus.REFUNDABLE;
                    return base_1.SwapCommitStatus.COMMITED;
                case ESCROW_STATE_CLAIMED:
                    return base_1.SwapCommitStatus.PAID;
                default:
                    if (this.isExpired(signer, data))
                        return base_1.SwapCommitStatus.EXPIRED;
                    return base_1.SwapCommitStatus.NOT_COMMITED;
            }
        });
    }
    /**
     * Checks the status of the specific payment hash
     *
     * @param paymentHash
     */
    getPaymentHashStatus(paymentHash) {
        return __awaiter(this, void 0, void 0, function* () {
            //TODO: Noop
            return base_1.SwapCommitStatus.NOT_COMMITED;
        });
    }
    /**
     * Returns the data committed for a specific payment hash, or null if no data is currently commited for
     *  the specific swap
     *
     * @param paymentHashHex
     */
    getCommitedData(paymentHashHex) {
        return __awaiter(this, void 0, void 0, function* () {
            //TODO: Noop
            return null;
        });
    }
    ////////////////////////////////////////////
    //// Swap data initializer
    createSwapData(type, offerer, claimer, token, amount, paymentHash, sequence, expiry, escrowNonce, confirmations, payIn, payOut, securityDeposit, claimerBounty) {
        var _a;
        return Promise.resolve(new StarknetSwapData_1.StarknetSwapData(offerer, claimer, token, TimelockRefundHandler_1.TimelockRefundHandler.address, (_a = ClaimHandlers_1.claimHandlersBySwapType === null || ClaimHandlers_1.claimHandlersBySwapType === void 0 ? void 0 : ClaimHandlers_1.claimHandlersBySwapType[type]) === null || _a === void 0 ? void 0 : _a.address, payOut, payIn, !payIn, //For now track reputation for all non payIn swaps
        sequence, (0, Utils_1.toHex)(paymentHash), (0, Utils_1.toHex)(expiry), amount, this.Tokens.getNativeCurrencyAddress(), securityDeposit, claimerBounty, null));
    }
    ////////////////////////////////////////////
    //// Utils
    getBalance(signer, tokenAddress, inContract) {
        return __awaiter(this, void 0, void 0, function* () {
            if (inContract)
                return yield this.getIntermediaryBalance(signer, tokenAddress);
            //TODO: For native token we should discount the cost of deploying an account if it is not deployed yet
            return yield this.Tokens.getTokenBalance(signer, tokenAddress);
        });
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
    txsClaimWithSecret(signer, swapData, secret, checkExpiry, initAta, feeRate, skipAtaCheck) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.Claim.txsClaimWithSecret(typeof (signer) === "string" ? new PublicKey(signer) : signer.getPublicKey(), swapData, secret, checkExpiry, initAta, feeRate, skipAtaCheck);
        });
    }
    txsClaimWithTxData(signer, swapData, blockheight, tx, vout, commitedHeader, synchronizer, initAta, feeRate, storageAccHolder) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.Claim.txsClaimWithTxData(typeof (signer) === "string" ? new PublicKey(signer) : signer, swapData, blockheight, tx, vout, commitedHeader, synchronizer, initAta, storageAccHolder, feeRate);
        });
    }
    txsRefund(swapData, check, initAta, feeRate) {
        return this.Refund.txsRefund(swapData, check, feeRate);
    }
    txsRefundWithAuthorization(swapData, { timeout, prefix, signature }, check, initAta, feeRate) {
        return this.Refund.txsRefundWithAuthorization(swapData, timeout, prefix, signature, check, feeRate);
    }
    txsInitPayIn(swapData, { timeout, prefix, signature }, skipChecks, feeRate) {
        return this.Init.txsInit(swapData, timeout, prefix, signature, skipChecks, feeRate);
    }
    txsInit(swapData, { timeout, prefix, signature }, txoHash, skipChecks, feeRate) {
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
    claimWithSecret(signer, swapData, secret, checkExpiry, initAta, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.Claim.txsClaimWithSecret(signer.getPublicKey(), swapData, secret, checkExpiry, initAta, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            const [signature] = yield this.Transactions.sendAndConfirm(signer, result, txOptions === null || txOptions === void 0 ? void 0 : txOptions.waitForConfirmation, txOptions === null || txOptions === void 0 ? void 0 : txOptions.abortSignal);
            return signature;
        });
    }
    claimWithTxData(signer, swapData, blockheight, tx, vout, commitedHeader, synchronizer, initAta, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = {
                storageAcc: null
            };
            const txs = yield this.Claim.txsClaimWithTxData(signer, swapData, blockheight, tx, vout, commitedHeader, synchronizer, initAta, data, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            if (txs === null)
                throw new Error("Btc relay not synchronized to required blockheight!");
            //TODO: This doesn't return proper tx signature
            const [signature] = yield this.Transactions.sendAndConfirm(signer, txs, txOptions === null || txOptions === void 0 ? void 0 : txOptions.waitForConfirmation, txOptions === null || txOptions === void 0 ? void 0 : txOptions.abortSignal);
            yield this.DataAccount.removeDataAccount(data.storageAcc);
            return signature;
        });
    }
    refund(signer, swapData, check, initAta, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!swapData.isOfferer(signer.getAddress()))
                throw new Error("Invalid signer provided!");
            let result = yield this.txsRefund(swapData, check, initAta, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            const [signature] = yield this.Transactions.sendAndConfirm(signer, result, txOptions === null || txOptions === void 0 ? void 0 : txOptions.waitForConfirmation, txOptions === null || txOptions === void 0 ? void 0 : txOptions.abortSignal);
            return signature;
        });
    }
    refundWithAuthorization(signer, swapData, signature, check, initAta, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!swapData.isOfferer(signer.getAddress()))
                throw new Error("Invalid signer provided!");
            let result = yield this.txsRefundWithAuthorization(swapData, signature, check, initAta, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            const [txSignature] = yield this.Transactions.sendAndConfirm(signer, result, txOptions === null || txOptions === void 0 ? void 0 : txOptions.waitForConfirmation, txOptions === null || txOptions === void 0 ? void 0 : txOptions.abortSignal);
            return txSignature;
        });
    }
    initPayIn(signer, swapData, signature, skipChecks, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!swapData.isOfferer(signer.getAddress()))
                throw new Error("Invalid signer provided!");
            let result = yield this.txsInitPayIn(swapData, signature, skipChecks, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            const signatures = yield this.Transactions.sendAndConfirm(signer, result, txOptions === null || txOptions === void 0 ? void 0 : txOptions.waitForConfirmation, txOptions === null || txOptions === void 0 ? void 0 : txOptions.abortSignal);
            return signatures[signatures.length - 1];
        });
    }
    init(signer, swapData, signature, txoHash, skipChecks, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!swapData.isClaimer(signer.getAddress()))
                throw new Error("Invalid signer provided!");
            let result = yield this.txsInit(swapData, signature, txoHash, skipChecks, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            const [txSignature] = yield this.Transactions.sendAndConfirm(signer, result, txOptions === null || txOptions === void 0 ? void 0 : txOptions.waitForConfirmation, txOptions === null || txOptions === void 0 ? void 0 : txOptions.abortSignal);
            return txSignature;
        });
    }
    initAndClaimWithSecret(signer, swapData, signature, secret, skipChecks, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!swapData.isClaimer(signer.getAddress()))
                throw new Error("Invalid signer provided!");
            const txsCommit = yield this.txsInit(swapData, signature, null, skipChecks, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            const txsClaim = yield this.Claim.txsClaimWithSecret(signer.getAddress(), swapData, secret, true, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            return yield this.Transactions.sendAndConfirm(signer, txsCommit.concat(txsClaim), txOptions === null || txOptions === void 0 ? void 0 : txOptions.waitForConfirmation, txOptions === null || txOptions === void 0 ? void 0 : txOptions.abortSignal);
        });
    }
    withdraw(signer, token, amount, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const txs = yield this.LpVault.txsWithdraw(signer.getAddress(), token, amount, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            const [txId] = yield this.Transactions.sendAndConfirm(signer, txs, txOptions === null || txOptions === void 0 ? void 0 : txOptions.waitForConfirmation, txOptions === null || txOptions === void 0 ? void 0 : txOptions.abortSignal, false);
            return txId;
        });
    }
    deposit(signer, token, amount, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const txs = yield this.LpVault.txsDeposit(signer.getAddress(), token, amount, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            const [txId] = yield this.Transactions.sendAndConfirm(signer, txs, txOptions === null || txOptions === void 0 ? void 0 : txOptions.waitForConfirmation, txOptions === null || txOptions === void 0 ? void 0 : txOptions.abortSignal, false);
            return txId;
        });
    }
    transfer(signer, token, amount, dstAddress, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const txs = yield this.Tokens.txsTransfer(signer.getAddress(), token, amount, dstAddress, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            const [txId] = yield this.Transactions.sendAndConfirm(signer, txs, txOptions === null || txOptions === void 0 ? void 0 : txOptions.waitForConfirmation, txOptions === null || txOptions === void 0 ? void 0 : txOptions.abortSignal, false);
            return txId;
        });
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
        const privateKey = buffer_1.Buffer.from(starknet_1.ec.starkCurve.utils.randomPrivateKey()).toString("hex");
        const wallet = new StarknetKeypairWallet_1.StarknetKeypairWallet(this.provider, privateKey);
        return new StarknetSigner_1.StarknetSigner(wallet);
    }
}
exports.StarknetSwapContract = StarknetSwapContract;
