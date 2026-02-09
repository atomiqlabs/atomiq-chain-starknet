"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetFees = exports.starknetGasAdd = exports.starknetGasMul = void 0;
const Utils_1 = require("../../../utils/Utils");
const MAX_FEE_AGE = 5000;
/**
 * Multiplies all the gas parameters by a specific scalar
 *
 * @param gas
 * @param scalar
 */
function starknetGasMul(gas, scalar) {
    return { l1Gas: gas.l1Gas * scalar, l2Gas: gas.l2Gas * scalar, l1DataGas: gas.l1DataGas * scalar };
}
exports.starknetGasMul = starknetGasMul;
/**
 * Sums up all the gas parameters
 *
 * @param a
 * @param b
 */
function starknetGasAdd(a, b) {
    if (b == null)
        return a;
    return { l1Gas: a.l1Gas + b.l1Gas, l2Gas: a.l2Gas + b.l2Gas, l1DataGas: a.l1DataGas + b.l1DataGas };
}
exports.starknetGasAdd = starknetGasAdd;
/**
 * A module for starknet fee estimation
 *
 * @category Chain Interface
 */
class StarknetFees {
    /**
     * Constructs a new Starknet fee module
     *
     * @param provider A starknet.js provider to use for fee estimation
     * @param maxFeeRate Fee rate limits in base units
     * @param feeMultiplier A multiplier to use for the returned fee rates
     * @param da Data-availability mode - currently just L1
     */
    constructor(provider, maxFeeRate = { l1GasCost: 20000000000000000n, l2GasCost: 4000000000000000n, l1DataGasCost: 10000000000000000n }, feeMultiplier = 1.25, da) {
        this.logger = (0, Utils_1.getLogger)("StarknetFees: ");
        this.provider = provider;
        this.maxFeeRate = maxFeeRate;
        this.feeDA = da?.fee ?? "L1";
        this.nonceDA = da?.nonce ?? "L1";
        this.feeMultiplierPPM = BigInt(Math.floor(feeMultiplier * 1000000));
    }
    /**
     * Gets starknet fee rate
     *
     * @private
     * @returns {Promise<StarknetFeeRate>} L1 gas price denominated in Wei
     */
    async _getFeeRate() {
        const block = await this.provider.getBlock("latest");
        let l1GasCost = (0, Utils_1.toBigInt)(block.l1_gas_price.price_in_fri) * this.feeMultiplierPPM / 1000000n;
        let l1DataGasCost = (0, Utils_1.toBigInt)(block.l1_data_gas_price.price_in_fri) * this.feeMultiplierPPM / 1000000n;
        let l2GasCost = (0, Utils_1.toBigInt)(block.l2_gas_price.price_in_fri) * this.feeMultiplierPPM / 1000000n;
        this.logger.debug("_getFeeRate(): L1 fee rate: ", [l1GasCost.toString(10), l1DataGasCost.toString(10), l2GasCost.toString(10)]);
        return {
            l1GasCost, l2GasCost, l1DataGasCost
        };
    }
    /**
     * Gets the gas price with caching, format: <gas price in Wei>;<transaction version: v1/v3>
     *
     * @private
     */
    async getFeeRate() {
        if (this.blockFeeCache == null || Date.now() - this.blockFeeCache.timestamp > MAX_FEE_AGE) {
            let obj;
            this.blockFeeCache = obj = {
                timestamp: Date.now(),
                feeRate: this._getFeeRate().catch(e => {
                    if (this.blockFeeCache === obj)
                        delete this.blockFeeCache;
                    throw e;
                })
            };
        }
        let { l1GasCost, l2GasCost, l1DataGasCost } = await this.blockFeeCache.feeRate;
        if (l1GasCost > this.maxFeeRate.l1GasCost)
            l1GasCost = this.maxFeeRate.l1GasCost;
        if (l2GasCost > this.maxFeeRate.l2GasCost)
            l2GasCost = this.maxFeeRate.l2GasCost;
        if (l1DataGasCost > this.maxFeeRate.l1DataGasCost)
            l1DataGasCost = this.maxFeeRate.l1DataGasCost;
        const fee = l1GasCost.toString(10) + "," + l2GasCost.toString(10) + "," + l1DataGasCost.toString(10) + ";v3";
        this.logger.debug("getFeeRate(): calculated fee: " + fee);
        return fee;
    }
    /**
     * A utility function for deserializing a stringified starknet fee rate to its constituent fees
     *
     * @param feeRate Serialized fee rate in format: [l1Gas],[l2Gas],[l1DataGas]
     */
    static extractFromFeeRateString(feeRate) {
        const arr = feeRate.split(";");
        const [l1GasCostStr, l2GasCostStr, l1DataGasCostStr] = arr[0].split(",");
        return {
            l1GasCost: BigInt(l1GasCostStr),
            l2GasCost: BigInt(l2GasCostStr),
            l1DataGasCost: BigInt(l1DataGasCostStr)
        };
    }
    /**
     * Calculates the total gas fee paid for a given gas limit at a given fee rate
     *
     * @param gas Gas limits
     * @param feeRate Fee rate to use for the calculation, serialized as a string: [l1Gas],[l2Gas],[l1DataGas]
     */
    static getGasFee(gas, feeRate) {
        if (feeRate == null)
            return 0n;
        const { l1GasCost, l2GasCost, l1DataGasCost } = StarknetFees.extractFromFeeRateString(feeRate);
        return (BigInt(gas.l1Gas) * l1GasCost) +
            (BigInt(gas.l2Gas) * l2GasCost) +
            (BigInt(gas.l1DataGas) * l1DataGasCost);
    }
    /**
     * Returns transaction details that apply the corresponding gas limits and gas price to the transaction
     *
     * @param gas Gas limits
     * @param feeRate Fee rate to use for the calculation, serialized as a string: [l1Gas],[l2Gas],[l1DataGas]
     */
    getFeeDetails(gas, feeRate) {
        if (feeRate == null)
            throw new Error("No feeRate passed, cannot get fee details!");
        const { l1GasCost, l2GasCost, l1DataGasCost } = StarknetFees.extractFromFeeRateString(feeRate);
        return {
            version: "0x3",
            resourceBounds: {
                l1_gas: { max_amount: BigInt(gas.l1Gas), max_price_per_unit: l1GasCost },
                l2_gas: { max_amount: BigInt(gas.l2Gas), max_price_per_unit: l2GasCost },
                l1_data_gas: { max_amount: BigInt(gas.l1DataGas), max_price_per_unit: l1DataGasCost }
            },
            tip: 0n,
            paymasterData: [],
            nonceDataAvailabilityMode: this.nonceDA,
            feeDataAvailabilityMode: this.feeDA
        };
    }
}
exports.StarknetFees = StarknetFees;
