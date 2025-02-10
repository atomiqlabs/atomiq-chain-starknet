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
exports.SwapClaim = void 0;
const base_1 = require("@atomiqlabs/base");
const Utils_1 = require("../../../utils/Utils");
const StarknetSwapModule_1 = require("../StarknetSwapModule");
const StarknetAction_1 = require("../../base/StarknetAction");
const StarknetFees_1 = require("../../base/modules/StarknetFees");
class SwapClaim extends StarknetSwapModule_1.StarknetSwapModule {
    /**
     * Claim action which uses the provided witness for claiming the swap
     *
     * @param signer
     * @param swapData
     * @param witness
     * @param claimHandlerGas
     * @constructor
     * @private
     */
    Claim(signer, swapData, witness, claimHandlerGas) {
        return new StarknetAction_1.StarknetAction(signer, this.root, this.contract.populateTransaction.claim(swapData.toEscrowStruct(), witness), (0, StarknetAction_1.sumStarknetGas)(swapData.payOut ? SwapClaim.GasCosts.CLAIM_PAY_OUT : SwapClaim.GasCosts.CLAIM, claimHandlerGas));
    }
    /**
     * Creates transactions claiming the swap using a secret (for HTLC swaps)
     *
     * @param signer
     * @param swapData swap to claim
     * @param secret hex encoded secret pre-image to the HTLC hash
     * @param checkExpiry whether to check if the swap is already expired (trying to claim an expired swap with a secret
     *  is dangerous because we might end up revealing the secret to the counterparty without being able to claim the swap)
     * @param feeRate fee rate to use for the transaction
     */
    txsClaimWithSecret(signer, swapData, secret, checkExpiry, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            //We need to be sure that this transaction confirms in time, otherwise we reveal the secret to the counterparty
            // and won't claim the funds
            if (checkExpiry && (yield this.root.isExpired(swapData.claimer.toString(), swapData))) {
                throw new base_1.SwapDataVerificationError("Not enough time to reliably pay the invoice");
            }
            const claimHandler = this.root.claimHandlersByAddress[swapData.claimHandler.toLowerCase()];
            if (claimHandler == null)
                throw new base_1.SwapDataVerificationError("Unknown claim handler!");
            if (claimHandler.getType() !== base_1.ChainSwapType.HTLC)
                throw new base_1.SwapDataVerificationError("Invalid claim handler!");
            feeRate !== null && feeRate !== void 0 ? feeRate : (feeRate = yield this.root.Fees.getFeeRate());
            const { initialTxns, witness } = yield claimHandler.getWitness(signer, swapData, secret, feeRate);
            const action = this.Claim(signer, swapData, witness, claimHandler.getGas(swapData));
            yield action.addToTxs(initialTxns, feeRate);
            this.logger.debug("txsClaimWithSecret(): creating claim transaction, swap: " + swapData.getClaimHash() + " witness: ", witness.map(Utils_1.toHex));
            return initialTxns;
        });
    }
    /**
     * Creates transaction claiming the swap using a confirmed transaction data (for BTC on-chain swaps)
     *
     * @param signer
     * @param swapData swap to claim
     * @param tx bitcoin transaction that satisfies the swap condition
     * @param requiredConfirmations
     * @param vout vout of the bitcoin transaction that satisfies the swap condition
     * @param commitedHeader commited header data from btc relay (fetched internally if null)
     * @param synchronizer optional synchronizer to use in case we need to sync up the btc relay ourselves
     * @param feeRate fee rate to be used for the transactions
     */
    txsClaimWithTxData(signer, swapData, tx, requiredConfirmations, vout, commitedHeader, synchronizer, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            const claimHandler = this.root.claimHandlersByAddress[swapData.claimHandler.toLowerCase()];
            if (claimHandler == null)
                throw new base_1.SwapDataVerificationError("Unknown claim handler!");
            if (claimHandler.getType() !== base_1.ChainSwapType.CHAIN_NONCED &&
                claimHandler.getType() !== base_1.ChainSwapType.CHAIN_TXID &&
                claimHandler.getType() !== base_1.ChainSwapType.CHAIN)
                throw new base_1.SwapDataVerificationError("Invalid claim handler!");
            feeRate !== null && feeRate !== void 0 ? feeRate : (feeRate = yield this.root.Fees.getFeeRate());
            const { initialTxns, witness } = yield claimHandler.getWitness(signer, swapData, {
                tx,
                vout,
                requiredConfirmations,
                commitedHeader,
                btcRelay: this.root.btcRelay,
                synchronizer,
            }, feeRate);
            const action = this.Claim(signer, swapData, witness, claimHandler.getGas(swapData));
            yield action.addToTxs(initialTxns, feeRate);
            return initialTxns;
        });
    }
    /**
     * Get the estimated starknet transaction fee of the claim transaction
     */
    getClaimFee(swapData, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            feeRate !== null && feeRate !== void 0 ? feeRate : (feeRate = yield this.root.Fees.getFeeRate());
            let gasRequired = swapData.payOut ? SwapClaim.GasCosts.CLAIM_PAY_OUT : SwapClaim.GasCosts.CLAIM;
            const claimHandler = this.root.claimHandlersByAddress[swapData.claimHandler.toLowerCase()];
            if (claimHandler != null)
                gasRequired = (0, StarknetAction_1.sumStarknetGas)(gasRequired, claimHandler.getGas(swapData));
            return StarknetFees_1.StarknetFees.getGasFee(gasRequired.l1, feeRate);
        });
    }
}
exports.SwapClaim = SwapClaim;
SwapClaim.GasCosts = {
    CLAIM: { l1: 500, l2: 0 },
    CLAIM_PAY_OUT: { l1: 800, l2: 0 }
};
