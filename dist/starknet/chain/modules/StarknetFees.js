"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetFees = void 0;
const Utils_1 = require("../../../utils/Utils");
const StarknetTokens_1 = require("./StarknetTokens");
const MAX_FEE_AGE = 5000;
class StarknetFees {
    constructor(provider, gasToken = "STRK", maxFeeRate = gasToken === "ETH" ? 100000000000 /*100 GWei*/ : 1000000000000000 /*100 * 10000 GWei*/, feeMultiplier = 1.25, da) {
        this.logger = (0, Utils_1.getLogger)("StarknetFees: ");
        this.blockFeeCache = null;
        this.provider = provider;
        this.gasToken = gasToken;
        this.maxFeeRate = BigInt(maxFeeRate);
        this.feeDA = da?.fee ?? "L1";
        this.nonceDA = da?.nonce ?? "L1";
        this.feeMultiplierPPM = BigInt(Math.floor(feeMultiplier * 1000000));
    }
    /**
     * Gets starknet fee rate
     *
     * @private
     * @returns {Promise<BN>} L1 gas price denominated in Wei
     */
    async _getFeeRate() {
        const block = await this.provider.getBlockWithTxHashes("latest");
        let l1GasCost = (0, Utils_1.toBigInt)(this.gasToken === "ETH" ? block.l1_gas_price.price_in_wei : block.l1_gas_price.price_in_fri);
        l1GasCost = l1GasCost * this.feeMultiplierPPM / 1000000n;
        this.logger.debug("_getFeeRate(): L1 fee rate: " + l1GasCost.toString(10));
        return l1GasCost;
    }
    /**
     * Gets the gas price with caching, format: <gas price in Wei>;<transaction version: v1/v3>
     *
     * @private
     */
    async getFeeRate() {
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
        let feeRate = await this.blockFeeCache.feeRate;
        if (feeRate > this.maxFeeRate)
            feeRate = this.maxFeeRate;
        const fee = feeRate.toString(10) + ";" + (this.gasToken === "ETH" ? "v1" : "v3");
        this.logger.debug("getFeeRate(): calculated fee: " + fee);
        return fee;
    }
    getDefaultGasToken() {
        return this.gasToken === "ETH" ? StarknetTokens_1.StarknetTokens.ERC20_ETH : StarknetTokens_1.StarknetTokens.ERC20_STRK;
    }
    /**
     * Calculates the total gas fee fee paid for a given gas limit at a given fee rate
     *
     * @param gas
     * @param feeRate
     */
    static getGasFee(gas, feeRate) {
        if (feeRate == null)
            return 0n;
        const arr = feeRate.split(";");
        const gasPrice = BigInt(arr[0]);
        return gasPrice * BigInt(gas);
    }
    static getGasToken(feeRate) {
        if (feeRate == null)
            return null;
        const arr = feeRate.split(";");
        const txVersion = arr[1];
        return txVersion === "v1" ? StarknetTokens_1.StarknetTokens.ERC20_ETH : StarknetTokens_1.StarknetTokens.ERC20_STRK;
    }
    getFeeDetails(L1GasLimit, L2GasLimit, feeRate) {
        if (feeRate == null)
            return null;
        const arr = feeRate.split(";");
        const gasPrice = BigInt(arr[0]);
        const version = arr[1];
        const maxFee = (0, Utils_1.toHex)(BigInt(L1GasLimit) * gasPrice, 16);
        return {
            maxFee: maxFee,
            version: version === "v1" ? "0x1" : "0x3",
            resourceBounds: {
                l1_gas: { max_amount: (0, Utils_1.toHex)(L1GasLimit, 16), max_price_per_unit: (0, Utils_1.toHex)(gasPrice, 16) },
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
