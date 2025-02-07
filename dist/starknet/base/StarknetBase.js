"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetBase = void 0;
const Utils_1 = require("../../utils/Utils");
const StarknetTransactions_1 = require("./modules/StarknetTransactions");
const StarknetFees_1 = require("./modules/StarknetFees");
const StarknetAddresses_1 = require("./modules/StarknetAddresses");
const StarknetTokens_1 = require("./modules/StarknetTokens");
const StarknetEvents_1 = require("./modules/StarknetEvents");
const StarknetSignatures_1 = require("./modules/StarknetSignatures");
const StarknetAccounts_1 = require("./modules/StarknetAccounts");
class StarknetBase {
    constructor(chainId, provider, retryPolicy, solanaFeeEstimator = new StarknetFees_1.StarknetFees(provider)) {
        this.logger = (0, Utils_1.getLogger)(this.constructor.name + ": ");
        this.starknetChainId = chainId;
        this.provider = provider;
        this.retryPolicy = retryPolicy;
        this.Fees = solanaFeeEstimator;
        this.Tokens = new StarknetTokens_1.StarknetTokens(this);
        this.Transactions = new StarknetTransactions_1.StarknetTransactions(this);
        this.Addresses = new StarknetAddresses_1.StarknetAddresses(this);
        this.Signatures = new StarknetSignatures_1.StarknetSignatures(this);
        this.Events = new StarknetEvents_1.StarknetEvents(this);
        this.Accounts = new StarknetAccounts_1.StarknetAccounts(this);
    }
}
exports.StarknetBase = StarknetBase;
