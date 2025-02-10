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
exports.StarknetSwapRefund = void 0;
const base_1 = require("@atomiqlabs/base");
const BN = require("bn.js");
const Utils_1 = require("../../../utils/Utils");
const StarknetSwapModule_1 = require("../StarknetSwapModule");
const StarknetAction_1 = require("../../base/StarknetAction");
const StarknetFees_1 = require("../../base/modules/StarknetFees");
const Refund = [
    { name: 'Swap hash', type: 'felt' },
    { name: 'Timeout', type: 'timestamp' }
];
class StarknetSwapRefund extends StarknetSwapModule_1.StarknetSwapModule {
    /**
     * Action for generic Refund instruction
     *
     * @param signer
     * @param swapData
     * @param witness
     * @param handlerGas
     * @constructor
     * @private
     */
    Refund(signer, swapData, witness, handlerGas) {
        return new StarknetAction_1.StarknetAction(signer, this.root, this.contract.populateTransaction.refund(swapData.toEscrowStruct(), witness), (0, StarknetAction_1.sumStarknetGas)(swapData.payIn ? StarknetSwapRefund.GasCosts.REFUND_PAY_OUT : StarknetSwapRefund.GasCosts.REFUND, handlerGas));
    }
    /**
     * Action for cooperative refunding with signature
     *
     * @param sender
     * @param swapData
     * @param timeout
     * @param signature
     * @constructor
     * @private
     */
    RefundWithSignature(sender, swapData, timeout, signature) {
        return new StarknetAction_1.StarknetAction(sender, this.root, this.contract.populateTransaction.cooperative_refund(swapData.toEscrowStruct(), signature, BigInt(timeout)), swapData.payIn ? StarknetSwapRefund.GasCosts.REFUND_PAY_OUT : StarknetSwapRefund.GasCosts.REFUND);
    }
    constructor(root) {
        super(root);
    }
    signSwapRefund(signer, swapData, authorizationTimeout) {
        return __awaiter(this, void 0, void 0, function* () {
            const authPrefix = "refund";
            const authTimeout = Math.floor(Date.now() / 1000) + authorizationTimeout;
            const signature = yield this.root.Signatures.signTypedMessage(signer, Refund, "Refund", {
                "Swap hash": (0, Utils_1.toHex)(swapData.getEscrowHash()),
                "Timeout": (0, Utils_1.toHex)(authTimeout)
            });
            return {
                prefix: authPrefix,
                timeout: authTimeout.toString(10),
                signature: signature
            };
        });
    }
    isSignatureValid(swapData, timeout, prefix, signature) {
        return __awaiter(this, void 0, void 0, function* () {
            if (prefix !== "refund")
                throw new base_1.SignatureVerificationError("Invalid prefix");
            const expiryTimestamp = new BN(timeout);
            const currentTimestamp = new BN(Math.floor(Date.now() / 1000));
            const isExpired = expiryTimestamp.sub(currentTimestamp).lt(new BN(this.root.authGracePeriod));
            if (isExpired)
                throw new base_1.SignatureVerificationError("Authorization expired!");
            const valid = yield this.root.Signatures.isValidSignature(signature, swapData.claimer, Refund, "Refund", {
                "Swap hash": (0, Utils_1.toHex)(swapData.getEscrowHash()),
                "Timeout": (0, Utils_1.toHex)(expiryTimestamp)
            });
            if (!valid) {
                throw new base_1.SignatureVerificationError("Invalid signature!");
            }
            return null;
        });
    }
    /**
     * Creates transactions required for refunding timed out swap
     *
     * @param swapData swap data to refund
     * @param check whether to check if swap is already expired and refundable
     * @param feeRate fee rate to be used for the transactions
     * @param witnessData
     */
    txsRefund(swapData, check, feeRate, witnessData) {
        return __awaiter(this, void 0, void 0, function* () {
            const refundHandler = this.root.refundHandlersByAddress[swapData.refundHandler.toLowerCase()];
            if (refundHandler == null)
                throw new Error("Invalid refund handler");
            if (check && !(yield (0, Utils_1.tryWithRetries)(() => this.root.isRequestRefundable(swapData.offerer.toString(), swapData), this.retryPolicy))) {
                throw new base_1.SwapDataVerificationError("Not refundable yet!");
            }
            feeRate !== null && feeRate !== void 0 ? feeRate : (feeRate = yield this.root.Fees.getFeeRate());
            const { initialTxns, witness } = yield refundHandler.getWitness(swapData.offerer, swapData, witnessData, feeRate);
            const action = this.Refund(swapData.offerer, swapData, witness, refundHandler.getGas(swapData));
            yield action.addToTxs(initialTxns, feeRate);
            this.logger.debug("txsRefund(): creating refund transaction, swap: " + swapData.getClaimHash());
            return initialTxns;
        });
    }
    /**
     * Creates transactions required for refunding the swap with authorization signature, also unwraps WSOL to SOL
     *
     * @param swapData swap data to refund
     * @param timeout signature timeout
     * @param prefix signature prefix of the counterparty
     * @param signature signature of the counterparty
     * @param check whether to check if swap is committed before attempting refund
     * @param feeRate fee rate to be used for the transactions
     */
    txsRefundWithAuthorization(swapData, timeout, prefix, signature, check, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            if (check && !(yield (0, Utils_1.tryWithRetries)(() => this.root.isCommited(swapData), this.retryPolicy))) {
                throw new base_1.SwapDataVerificationError("Not correctly committed");
            }
            yield (0, Utils_1.tryWithRetries)(() => this.isSignatureValid(swapData, timeout, prefix, signature), this.retryPolicy, (e) => e instanceof base_1.SignatureVerificationError);
            const action = this.RefundWithSignature(swapData.offerer, swapData, timeout, JSON.parse(signature));
            feeRate !== null && feeRate !== void 0 ? feeRate : (feeRate = yield this.root.Fees.getFeeRate());
            this.logger.debug("txsRefundWithAuthorization(): creating refund transaction, swap: " + swapData.getClaimHash() +
                " auth expiry: " + timeout + " signature: " + signature);
            return [yield action.tx(feeRate)];
        });
    }
    /**
     * Get the estimated solana transaction fee of the refund transaction, in the worst case scenario in case where the
     *  ATA needs to be initialized again (i.e. adding the ATA rent exempt lamports to the fee)
     */
    getRefundFee(swapData, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            feeRate !== null && feeRate !== void 0 ? feeRate : (feeRate = yield this.root.Fees.getFeeRate());
            return StarknetFees_1.StarknetFees.getGasFee(swapData.payIn ? StarknetSwapRefund.GasCosts.REFUND_PAY_OUT.l1 : StarknetSwapRefund.GasCosts.REFUND.l1, feeRate);
        });
    }
}
exports.StarknetSwapRefund = StarknetSwapRefund;
StarknetSwapRefund.GasCosts = {
    REFUND: { l1: 750, l2: 0 },
    REFUND_PAY_OUT: { l1: 1250, l2: 0 }
};
