"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetContractBase = void 0;
const StarknetBase_1 = require("../base/StarknetBase");
const starknet_1 = require("starknet");
const StarknetFees_1 = require("../base/modules/StarknetFees");
const StarknetContractEvents_1 = require("./modules/StarknetContractEvents");
/**
 * Base class providing program specific utilities
 */
class StarknetContractBase extends StarknetBase_1.StarknetBase {
    constructor(chainId, provider, contractAddress, contractAbi, retryPolicy, solanaFeeEstimator = new StarknetFees_1.StarknetFees(provider)) {
        super(chainId, provider, retryPolicy, solanaFeeEstimator);
        const contract = new starknet_1.Contract(contractAbi, contractAddress, provider).typedv2(contractAbi);
        this.Events = new StarknetContractEvents_1.StarknetContractEvents(this);
    }
}
exports.StarknetContractBase = StarknetContractBase;
