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
exports.StarknetLpVault = void 0;
const Utils_1 = require("../../../utils/Utils");
const StarknetSwapModule_1 = require("../StarknetSwapModule");
const StarknetAction_1 = require("../../base/StarknetAction");
const starknet_1 = require("starknet");
class StarknetLpVault extends StarknetSwapModule_1.StarknetSwapModule {
    /**
     * Action for withdrawing funds from the LP vault
     *
     * @param signer
     * @param token
     * @param amount
     * @constructor
     * @private
     */
    Withdraw(signer, token, amount) {
        return new StarknetAction_1.StarknetAction(signer, this.root, this.contract.populateTransaction.withdraw(token, starknet_1.cairo.uint256((0, Utils_1.toBigInt)(amount)), signer), StarknetLpVault.GasCosts.WITHDRAW);
    }
    /**
     * Action for depositing funds to the LP vault
     *
     * @param signer
     * @param token
     * @param amount
     * @constructor
     * @private
     */
    Deposit(signer, token, amount) {
        return new StarknetAction_1.StarknetAction(signer, this.root, this.contract.populateTransaction.deposit(token, starknet_1.cairo.uint256((0, Utils_1.toBigInt)(amount))), StarknetLpVault.GasCosts.WITHDRAW);
    }
    /**
     * Returns intermediary's reputation & vault balance for a specific token
     *
     * @param address
     * @param token
     */
    getIntermediaryData(address, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const [balance, reputation] = yield Promise.all([
                this.getIntermediaryBalance(address, token),
                this.getIntermediaryReputation(address, token)
            ]);
            return { balance, reputation };
        });
    }
    /**
     * Returns intermediary's reputation for a specific token
     *
     * @param address
     * @param token
     */
    getIntermediaryReputation(address, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const filter = Object.keys(this.root.claimHandlersByAddress).map(address => starknet_1.cairo.tuple(address, token, address));
            const reputation = yield this.contract.get_reputation(filter);
            const result = {};
            Object.keys(this.root.claimHandlersByAddress).forEach((address, index) => {
                const handler = this.root.claimHandlersByAddress[address];
                const reputationData = reputation[index];
                result[handler.getType()] = {
                    successVolume: (0, Utils_1.toBN)(reputationData[0].amount),
                    successCount: (0, Utils_1.toBN)(reputationData[0].count),
                    failVolume: (0, Utils_1.toBN)(reputationData[2].amount),
                    failCount: (0, Utils_1.toBN)(reputationData[2].count),
                    coopCloseVolume: (0, Utils_1.toBN)(reputationData[1].amount),
                    coopCloseCount: (0, Utils_1.toBN)(reputationData[1].count),
                };
            });
            return result;
        });
    }
    /**
     * Returns the balance of the token an intermediary has in his LP vault
     *
     * @param address
     * @param token
     */
    getIntermediaryBalance(address, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const balance = (0, Utils_1.toBN)((yield this.contract.get_balance([starknet_1.cairo.tuple(address, token)]))[0]);
            this.logger.debug("getIntermediaryBalance(): token LP balance fetched, token: " + token.toString() +
                " address: " + address + " amount: " + (balance == null ? "null" : balance.toString()));
            return balance;
        });
    }
    /**
     * Creates transactions for withdrawing funds from the LP vault, creates ATA if it doesn't exist and unwraps
     *  WSOL to SOL if required
     *
     * @param signer
     * @param token
     * @param amount
     * @param feeRate
     */
    txsWithdraw(signer, token, amount, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            const action = yield this.Withdraw(signer, token, amount);
            feeRate !== null && feeRate !== void 0 ? feeRate : (feeRate = yield this.root.Fees.getFeeRate());
            this.logger.debug("txsWithdraw(): withdraw TX created, token: " + token.toString() +
                " amount: " + amount.toString(10));
            return [yield action.tx(feeRate)];
        });
    }
    /**
     * Creates transaction for depositing funds into the LP vault, wraps SOL to WSOL if required
     *
     * @param signer
     * @param token
     * @param amount
     * @param feeRate
     */
    txsDeposit(signer, token, amount, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            //Approve first
            const action = yield this.root.Tokens.Approve(signer, this.contract.address, token, amount);
            action.add(this.Deposit(signer, token, amount));
            feeRate !== null && feeRate !== void 0 ? feeRate : (feeRate = yield this.root.Fees.getFeeRate());
            this.logger.debug("txsDeposit(): deposit TX created, token: " + token.toString() +
                " amount: " + amount.toString(10));
            return [yield action.tx(feeRate)];
        });
    }
}
exports.StarknetLpVault = StarknetLpVault;
StarknetLpVault.GasCosts = {
    WITHDRAW: { l1: 750, l2: 0 },
    DEPOSIT: { l1: 750, l2: 0 }
};
