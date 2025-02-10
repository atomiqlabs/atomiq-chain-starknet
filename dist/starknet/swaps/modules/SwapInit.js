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
exports.SwapInit = void 0;
const base_1 = require("@atomiqlabs/base");
const BN = require("bn.js");
const Utils_1 = require("../../../utils/Utils");
const buffer_1 = require("buffer");
const StarknetAction_1 = require("../../base/StarknetAction");
const StarknetSwapModule_1 = require("../StarknetSwapModule");
const StarknetFees_1 = require("../../base/modules/StarknetFees");
const Initialize = [
    { name: 'Swap hash', type: 'felt' },
    { name: 'Timeout', type: 'timestamp' }
];
class SwapInit extends StarknetSwapModule_1.StarknetSwapModule {
    /**
     * bare Init action based on the data passed in swapData
     *
     * @param swapData
     * @param timeout
     * @param signature
     * @private
     */
    Init(swapData, timeout, signature) {
        return new StarknetAction_1.StarknetAction(swapData.payIn ? swapData.offerer : swapData.claimer, this.root, this.contract.populateTransaction.initialize(swapData.toEscrowStruct(), signature, (0, Utils_1.toBigInt)(timeout), swapData.extraData == null || swapData.extraData === "" ? [] : (0, Utils_1.bufferToBytes31Span)(buffer_1.Buffer.from(swapData.extraData, "hex")).map(Utils_1.toHex)), swapData.payIn ? SwapInit.GasCosts.INIT_PAY_IN : SwapInit.GasCosts.INIT);
    }
    /**
     * Returns auth prefix to be used with a specific swap, payIn=true & payIn=false use different prefixes (these
     *  actually have no meaning for the smart contract/solana program in the Solana case)
     *
     * @param swapData
     * @private
     */
    getAuthPrefix(swapData) {
        return swapData.isPayIn() ? "claim_initialize" : "initialize";
    }
    /**
     * Signs swap initialization authorization, using data from preFetchedBlockData if provided & still valid (subject
     *  to SIGNATURE_PREFETCH_DATA_VALIDITY)
     *
     * @param signer
     * @param swapData
     * @param authorizationTimeout
     * @public
     */
    signSwapInitialization(signer, swapData, authorizationTimeout) {
        return __awaiter(this, void 0, void 0, function* () {
            const authTimeout = Math.floor(Date.now() / 1000) + authorizationTimeout;
            const signature = yield this.root.Signatures.signTypedMessage(signer, Initialize, "Initialize", {
                "Swap hash": (0, Utils_1.toHex)(swapData.getEscrowHash()),
                "Timeout": (0, Utils_1.toHex)(authTimeout)
            });
            return {
                prefix: this.getAuthPrefix(swapData),
                timeout: authorizationTimeout.toString(10),
                signature
            };
        });
    }
    /**
     * Checks whether the provided signature data is valid, using preFetchedData if provided and still valid
     *
     * @param swapData
     * @param timeout
     * @param prefix
     * @param signature
     * @public
     */
    isSignatureValid(swapData, timeout, prefix, signature) {
        return __awaiter(this, void 0, void 0, function* () {
            const sender = swapData.isPayIn() ? swapData.offerer : swapData.claimer;
            const signer = swapData.isPayIn() ? swapData.claimer : swapData.offerer;
            if (!swapData.isPayIn() && (yield this.root.isExpired(sender.toString(), swapData))) {
                throw new base_1.SignatureVerificationError("Swap will expire too soon!");
            }
            if (prefix !== this.getAuthPrefix(swapData))
                throw new base_1.SignatureVerificationError("Invalid prefix");
            const currentTimestamp = new BN(Math.floor(Date.now() / 1000));
            const timeoutBN = new BN(timeout);
            const isExpired = timeoutBN.sub(currentTimestamp).lt(new BN(this.root.authGracePeriod));
            if (isExpired)
                throw new base_1.SignatureVerificationError("Authorization expired!");
            const valid = yield this.root.Signatures.isValidSignature(signature, signer, Initialize, "Initialize", {
                "Swap hash": (0, Utils_1.toHex)(swapData.getEscrowHash()),
                "Timeout": (0, Utils_1.toHex)(timeoutBN)
            });
            if (!valid)
                throw new base_1.SignatureVerificationError("Invalid signature!");
            return null;
        });
    }
    /**
     * Gets expiry of the provided signature data, this is a minimum of slot expiry & swap signature expiry
     *
     * @param timeout
     * @public
     */
    getSignatureExpiry(timeout) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            const timeoutExpiryTime = (parseInt(timeout) - this.root.authGracePeriod) * 1000;
            if (timeoutExpiryTime < now)
                return 0;
            return timeoutExpiryTime;
        });
    }
    /**
     * Checks whether signature is expired for good, uses expiry + grace period
     *
     * @param timeout
     * @public
     */
    isSignatureExpired(timeout) {
        return __awaiter(this, void 0, void 0, function* () {
            return (parseInt(timeout) + this.root.authGracePeriod) * 1000 < Date.now();
        });
    }
    /**
     * Creates init transaction with a valid signature from an LP
     *
     * @param swapData swap to initialize
     * @param timeout init signature timeout
     * @param prefix init signature prefix
     * @param signature init signature
     * @param skipChecks whether to skip signature validity checks
     * @param feeRate fee rate to use for the transaction
     */
    txsInit(swapData, timeout, prefix, signature, skipChecks, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            const sender = swapData.isPayIn() ? swapData.offerer : swapData.claimer;
            if (!skipChecks) {
                const [_, payStatus] = yield Promise.all([
                    (0, Utils_1.tryWithRetries)(() => this.isSignatureValid(swapData, timeout, prefix, signature), this.retryPolicy, (e) => e instanceof base_1.SignatureVerificationError),
                    (0, Utils_1.tryWithRetries)(() => this.root.getCommitStatus(sender, swapData), this.retryPolicy)
                ]);
                if (payStatus !== base_1.SwapCommitStatus.NOT_COMMITED)
                    throw new base_1.SwapDataVerificationError("Invoice already being paid for or paid");
            }
            feeRate !== null && feeRate !== void 0 ? feeRate : (feeRate = yield this.root.Fees.getFeeRate());
            const initAction = this.Init(swapData, new BN(timeout), JSON.parse(signature));
            if (swapData.payIn)
                initAction.addAction(this.root.Tokens.Approve(sender, this.contract.address, swapData.token, swapData.amount), 0); //Add erc20 approve
            if (!swapData.getTotalDeposit().isZero())
                initAction.addAction(this.root.Tokens.Approve(sender, this.contract.address, swapData.feeToken, swapData.getTotalDeposit()), 0); //Add deposit erc20 approve
            this.logger.debug("txsInitPayIn(): create swap init TX, swap: " + swapData.getClaimHash() +
                " feerate: " + feeRate);
            return [yield initAction.tx(feeRate)];
        });
    }
    /**
     * Get the estimated solana fee of the init transaction, this includes the required deposit for creating swap PDA
     *  and also deposit for ATAs
     */
    getInitFee(swapData, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            feeRate !== null && feeRate !== void 0 ? feeRate : (feeRate = yield this.root.Fees.getFeeRate());
            return StarknetFees_1.StarknetFees.getGasFee(swapData.payIn ? SwapInit.GasCosts.INIT_PAY_IN.l1 : SwapInit.GasCosts.INIT.l1, feeRate);
        });
    }
}
exports.SwapInit = SwapInit;
SwapInit.GasCosts = {
    INIT: { l1: 500, l2: 0 },
    INIT_PAY_IN: { l1: 800, l2: 0 },
};
