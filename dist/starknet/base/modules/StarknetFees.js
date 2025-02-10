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
exports.StarknetFees = void 0;
const Utils_1 = require("../../../utils/Utils");
const BN = require("bn.js");
const MAX_FEE_AGE = 5000;
class StarknetFees {
    constructor(provider, gasToken = "ETH", maxFeeRate = gasToken === "ETH" ? 100000000000 /*100 GWei*/ : 1000000000000000 /*100 * 10000 GWei*/, da) {
        var _a, _b;
        this.logger = (0, Utils_1.getLogger)("StarknetFees: ");
        this.blockFeeCache = null;
        this.provider = provider;
        this.gasToken = gasToken;
        this.maxFeeRate = new BN(maxFeeRate);
        this.feeDA = (_a = da === null || da === void 0 ? void 0 : da.fee) !== null && _a !== void 0 ? _a : "L1";
        this.nonceDA = (_b = da === null || da === void 0 ? void 0 : da.nonce) !== null && _b !== void 0 ? _b : "L1";
    }
    /**
     * Gets starknet fee rate
     *
     * @private
     * @returns {Promise<BN>} L1 gas price denominated in Wei
     */
    _getFeeRate() {
        return __awaiter(this, void 0, void 0, function* () {
            const block = yield this.provider.getBlockWithTxHashes("latest");
            const l1GasCost = (0, Utils_1.toBN)(this.gasToken === "ETH" ? block.l1_gas_price.price_in_wei : block.l1_gas_price.price_in_fri);
            this.logger.debug("_getFeeRate(): L1 fee rate: " + l1GasCost.toString(10));
            return l1GasCost;
        });
    }
    /**
     * Gets the gas price with caching, format: <gas price in Wei>;<transaction version: v1/v3>
     *
     * @private
     */
    getFeeRate() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.blockFeeCache == null || Date.now() - this.blockFeeCache.timestamp > MAX_FEE_AGE) {
                let obj = {
                    timestamp: Date.now(),
                    feeRate: null
                };
                obj.feeRate = this._getFeeRate().catch(e => {
                    if (this.blockFeeCache === obj)
                        this.blockFeeCache = null;
                    throw e;
                });
                this.blockFeeCache = obj;
            }
            const feeRate = BN.min(yield this.blockFeeCache.feeRate, this.maxFeeRate);
            const fee = feeRate.toString(10) + ";" + (this.gasToken === "ETH" ? "v1" : "v3");
            this.logger.debug("getFeeRate(): calculated fee: " + fee);
            return fee;
        });
    }
    /**
     * Calculates the total gas fee fee paid for a given gas limit at a given fee rate
     *
     * @param gas
     * @param feeRate
     */
    static getGasFee(gas, feeRate) {
        if (feeRate == null)
            return new BN(0);
        const arr = feeRate.split(";");
        const gasPrice = new BN(arr[0]);
        return gasPrice.mul(new BN(gas));
    }
    getFeeDetails(L1GasLimit, L2GasLimit, feeRate) {
        if (feeRate == null)
            return null;
        const arr = feeRate.split(";");
        const gasPrice = BigInt(arr[0]);
        const version = arr[1];
        const maxFee = (0, Utils_1.toHex)(BigInt(L1GasLimit) * gasPrice);
        return {
            maxFee: maxFee,
            version: version === "v1" ? "0x1" : "0x3",
            resourceBounds: {
                l1_gas: { max_amount: (0, Utils_1.toHex)(L1GasLimit), max_price_per_unit: maxFee },
                l2_gas: { max_amount: "0x0", max_price_per_unit: "0x0" }
            },
            tip: "0x0",
            paymasterData: [],
            nonceDataAvailabilityMode: this.nonceDA,
            feeDataAvailabilityMode: this.feeDA
        };
    }
}
exports.StarknetFees = StarknetFees;
