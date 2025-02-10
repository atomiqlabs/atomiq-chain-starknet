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
    [starknet_1.constants.StarknetChainId.SN_SEPOLIA]: "0x06bafd4f1aab70558ac13e16c77d00b56f6ceb92798eb78be899029361f38bda",
    [starknet_1.constants.StarknetChainId.SN_MAIN]: ""
};
const defaultClaimAddresses = {
    [starknet_1.constants.StarknetChainId.SN_SEPOLIA]: {
        [base_1.ChainSwapType.HTLC]: "0x057c6664f349dfffb89617270e46ca118d4a83c29ae7219c35556aa4dc23120e",
        [base_1.ChainSwapType.CHAIN_TXID]: "0x021a43a5287c44d0b4eb1e1c2627cc211cb0102c8d4bf30eab562c89dd66cd7b",
        [base_1.ChainSwapType.CHAIN]: "0x05ac5c58c564ea31a381cd78cb5c27e445b84309d919b4988c263d191297f0f5",
        [base_1.ChainSwapType.CHAIN_NONCED]: "0x054bd5b8aefffbf9f434eea3b6623b88cfd7b1b9329e626c7c2bd0f2aa016b4a"
    },
    [starknet_1.constants.StarknetChainId.SN_MAIN]: {}
};
const defaultRefundAddresses = {
    [starknet_1.constants.StarknetChainId.SN_SEPOLIA]: {
        timelock: "0x0726415752e78da4549e09da7824ae20b45539ca1fca71c93b349887cc0cac0d"
    },
    [starknet_1.constants.StarknetChainId.SN_MAIN]: {
        timelock: ""
    }
};
class StarknetSwapContract extends StarknetContractBase_1.StarknetContractBase {
    constructor(chainId, provider, btcRelay, contractAddress = swapContractAddreses[chainId], retryPolicy, solanaFeeEstimator = new StarknetFees_1.StarknetFees(provider), handlerAddresses) {
        var _a, _b;
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
        handlerAddresses !== null && handlerAddresses !== void 0 ? handlerAddresses : (handlerAddresses = {});
        (_a = handlerAddresses.refund) !== null && _a !== void 0 ? _a : (handlerAddresses.refund = {});
        handlerAddresses.refund = Object.assign(Object.assign({}, defaultRefundAddresses[chainId]), handlerAddresses.refund);
        (_b = handlerAddresses.claim) !== null && _b !== void 0 ? _b : (handlerAddresses.claim = {});
        handlerAddresses.claim = Object.assign(Object.assign({}, defaultClaimAddresses[chainId]), handlerAddresses.claim);
        ClaimHandlers_1.claimHandlersList.forEach(handlerCtor => {
            const handler = new handlerCtor(handlerAddresses.claim[handlerCtor.type]);
            this.claimHandlersByAddress[handler.address] = handler;
            this.claimHandlersBySwapType[handlerCtor.type] = handler;
        });
        this.timelockRefundHandler = new TimelockRefundHandler_1.TimelockRefundHandler(handlerAddresses.refund.timelock);
        this.refundHandlersByAddress[this.timelockRefundHandler.address] = this.timelockRefundHandler;
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
        return __awaiter(this, void 0, void 0, function* () {
            if (!data.isClaimer(signer))
                return false;
            if (yield this.isExpired(signer, data))
                return false;
            return yield this.isCommited(data);
        });
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
        return Promise.resolve(data.getExpiry().lt(currentTimestamp));
    }
    /**
     * Checks if the swap is refundable by us, checks if we are offerer, if the swap is already expired & if the swap
     *  is still commited
     *
     * @param signer
     * @param data
     */
    isRequestRefundable(signer, data) {
        return __awaiter(this, void 0, void 0, function* () {
            //Swap can only be refunded by the offerer
            if (!data.isOfferer(signer))
                return false;
            if (!(yield this.isExpired(signer, data)))
                return false;
            return yield this.isCommited(data);
        });
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
    getExtraData(outputScript, amount, confirmations, nonce) {
        if (nonce == null)
            nonce = new BN(0);
        const txoHash = createHash("sha256").update(buffer_1.Buffer.concat([
            buffer_1.Buffer.from(amount.toArray("le", 8)),
            outputScript
        ])).digest();
        return buffer_1.Buffer.concat([
            txoHash,
            nonce.toArrayLike(buffer_1.Buffer, "be", 8),
            new BN(confirmations).toArrayLike(buffer_1.Buffer, "be", 2)
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
    getCommitStatus(signer, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const stateData = yield this.contract.get_hash_state((0, Utils_1.toHex)(data.getEscrowHash()));
            const state = Number(stateData.state);
            switch (state) {
                case ESCROW_STATE_COMMITTED:
                    if (data.isOfferer(signer) && (yield this.isExpired(signer, data)))
                        return base_1.SwapCommitStatus.REFUNDABLE;
                    return base_1.SwapCommitStatus.COMMITED;
                case ESCROW_STATE_CLAIMED:
                    return base_1.SwapCommitStatus.PAID;
                default:
                    if (yield this.isExpired(signer, data))
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
    createSwapData(type, offerer, claimer, token, amount, paymentHash, sequence, expiry, payIn, payOut, securityDeposit, claimerBounty) {
        var _a, _b;
        return Promise.resolve(new StarknetSwapData_1.StarknetSwapData(offerer, claimer, token, this.timelockRefundHandler.address, (_b = (_a = this.claimHandlersBySwapType) === null || _a === void 0 ? void 0 : _a[type]) === null || _b === void 0 ? void 0 : _b.address, payOut, payIn, !payIn, //For now track reputation for all non payIn swaps
        sequence, (0, Utils_1.toHex)(paymentHash), (0, Utils_1.toHex)(expiry), amount, this.Tokens.getNativeCurrencyAddress(), securityDeposit, claimerBounty, type, null));
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
            return this.Claim.txsClaimWithSecret(typeof (signer) === "string" ? signer : signer.getAddress(), swapData, secret, checkExpiry, feeRate);
        });
    }
    txsClaimWithTxData(signer, swapData, tx, requiredConfirmations, vout, commitedHeader, synchronizer, initAta, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.Claim.txsClaimWithTxData(typeof (signer) === "string" ? signer : signer.getAddress(), swapData, tx, requiredConfirmations, vout, commitedHeader, synchronizer, feeRate);
        });
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
    claimWithSecret(signer, swapData, secret, checkExpiry, initAta, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.Claim.txsClaimWithSecret(signer.getAddress(), swapData, secret, checkExpiry, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            const [signature] = yield this.Transactions.sendAndConfirm(signer, result, txOptions === null || txOptions === void 0 ? void 0 : txOptions.waitForConfirmation, txOptions === null || txOptions === void 0 ? void 0 : txOptions.abortSignal);
            return signature;
        });
    }
    claimWithTxData(signer, swapData, tx, requiredConfirmations, vout, commitedHeader, synchronizer, initAta, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const txs = yield this.Claim.txsClaimWithTxData(signer.getAddress(), swapData, tx, requiredConfirmations, vout, commitedHeader, synchronizer, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            if (txs === null)
                throw new Error("Btc relay not synchronized to required blockheight!");
            //TODO: This doesn't return proper tx signature
            const [signature] = yield this.Transactions.sendAndConfirm(signer, txs, txOptions === null || txOptions === void 0 ? void 0 : txOptions.waitForConfirmation, txOptions === null || txOptions === void 0 ? void 0 : txOptions.abortSignal);
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
    init(signer, swapData, signature, skipChecks, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            if (swapData.isPayIn()) {
                if (!swapData.isOfferer(signer.getAddress()))
                    throw new Error("Invalid signer provided!");
            }
            else {
                if (!swapData.isClaimer(signer.getAddress()))
                    throw new Error("Invalid signer provided!");
            }
            let result = yield this.txsInit(swapData, signature, skipChecks, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
            const [txSignature] = yield this.Transactions.sendAndConfirm(signer, result, txOptions === null || txOptions === void 0 ? void 0 : txOptions.waitForConfirmation, txOptions === null || txOptions === void 0 ? void 0 : txOptions.abortSignal);
            return txSignature;
        });
    }
    initAndClaimWithSecret(signer, swapData, signature, secret, skipChecks, txOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!swapData.isClaimer(signer.getAddress()))
                throw new Error("Invalid signer provided!");
            const txsCommit = yield this.txsInit(swapData, signature, skipChecks, txOptions === null || txOptions === void 0 ? void 0 : txOptions.feeRate);
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
        const privateKey = "0x" + buffer_1.Buffer.from(starknet_1.ec.starkCurve.utils.randomPrivateKey()).toString("hex");
        const wallet = new StarknetKeypairWallet_1.StarknetKeypairWallet(this.provider, privateKey);
        return new StarknetSigner_1.StarknetSigner(wallet);
    }
}
exports.StarknetSwapContract = StarknetSwapContract;
