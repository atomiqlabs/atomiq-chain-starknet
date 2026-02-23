import { Provider } from "starknet";
/**
 * Representation of a starknet feerate including costs for different units of gas
 *
 * @category Chain Interface
 */
export type StarknetFeeRate = {
    l1GasCost: bigint;
    l2GasCost: bigint;
    l1DataGasCost: bigint;
};
/**
 * Representation of the starknet transaction gas limits used to create resource bounds and estimate fees
 *
 * @category Chain Interface
 */
export type StarknetGas = {
    l1Gas: number;
    l2Gas: number;
    l1DataGas: number;
};
/**
 * Multiplies all the gas parameters by a specific scalar
 *
 * @param gas
 * @param scalar
 *
 * @category Chain Interface
 */
export declare function starknetGasMul(gas: StarknetGas, scalar: number): StarknetGas;
/**
 * Sums up all the gas parameters
 *
 * @param a
 * @param b
 *
 * @category Chain Interface
 */
export declare function starknetGasAdd(a: StarknetGas, b?: StarknetGas): StarknetGas;
/**
 * A module for starknet fee estimation
 *
 * @category Chain Interface
 */
export declare class StarknetFees {
    private readonly logger;
    private readonly feeDA;
    private readonly nonceDA;
    private readonly provider;
    private readonly maxFeeRate;
    private readonly feeMultiplierPPM;
    private blockFeeCache?;
    /**
     * Constructs a new Starknet fee module
     *
     * @param provider A starknet.js provider to use for fee estimation
     * @param maxFeeRate Fee rate limits in base units
     * @param feeMultiplier A multiplier to use for the returned fee rates
     * @param da Data-availability mode - currently just L1
     */
    constructor(provider: Provider, maxFeeRate?: StarknetFeeRate, feeMultiplier?: number, da?: {
        fee?: "L1" | "L2";
        nonce?: "L1" | "L2";
    });
    /**
     * Gets starknet fee rate
     *
     * @private
     * @returns {Promise<StarknetFeeRate>} L1 gas price denominated in Wei
     */
    private _getFeeRate;
    /**
     * Gets the gas price with caching, format: <gas price in Wei>;<transaction version: v1/v3>
     *
     * @private
     */
    getFeeRate(): Promise<string>;
    /**
     * A utility function for deserializing a stringified starknet fee rate to its constituent fees
     *
     * @param feeRate Serialized fee rate in format: [l1Gas],[l2Gas],[l1DataGas]
     */
    static extractFromFeeRateString(feeRate: string): StarknetFeeRate;
    /**
     * Calculates the total gas fee paid for a given gas limit at a given fee rate
     *
     * @param gas Gas limits
     * @param feeRate Fee rate to use for the calculation, serialized as a string: [l1Gas],[l2Gas],[l1DataGas]
     */
    static getGasFee(gas: StarknetGas, feeRate: string): bigint;
    /**
     * Returns transaction details that apply the corresponding gas limits and gas price to the transaction
     *
     * @param gas Gas limits
     * @param feeRate Fee rate to use for the calculation, serialized as a string: [l1Gas],[l2Gas],[l1DataGas]
     */
    getFeeDetails(gas: StarknetGas, feeRate: string): {
        version: "0x3";
        resourceBounds: {
            l1_gas: {
                max_amount: bigint;
                max_price_per_unit: bigint;
            };
            l2_gas: {
                max_amount: bigint;
                max_price_per_unit: bigint;
            };
            l1_data_gas: {
                max_amount: bigint;
                max_price_per_unit: bigint;
            };
        };
        tip: bigint;
        paymasterData: never[];
        nonceDataAvailabilityMode: "L1" | "L2";
        feeDataAvailabilityMode: "L1" | "L2";
    };
}
