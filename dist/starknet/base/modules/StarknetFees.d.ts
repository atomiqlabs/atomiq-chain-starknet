import * as BN from "bn.js";
import { Provider } from "starknet";
export declare class StarknetFees {
    private readonly logger;
    private readonly feeDA;
    private readonly nonceDA;
    private readonly provider;
    private readonly gasToken;
    private readonly maxFeeRate;
    private readonly feeMultiplierPPM;
    private blockFeeCache;
    constructor(provider: Provider, gasToken?: "ETH" | "STRK", maxFeeRate?: number, feeMultiplier?: number, da?: {
        fee?: "L1" | "L2";
        nonce?: "L1" | "L2";
    });
    /**
     * Gets starknet fee rate
     *
     * @private
     * @returns {Promise<BN>} L1 gas price denominated in Wei
     */
    private _getFeeRate;
    /**
     * Gets the gas price with caching, format: <gas price in Wei>;<transaction version: v1/v3>
     *
     * @private
     */
    getFeeRate(): Promise<string>;
    /**
     * Calculates the total gas fee fee paid for a given gas limit at a given fee rate
     *
     * @param gas
     * @param feeRate
     */
    static getGasFee(gas: number, feeRate: string): BN;
    getFeeDetails(L1GasLimit: number, L2GasLimit: number, feeRate: string): {
        maxFee: string;
        version: "0x3" | "0x1";
        resourceBounds: {
            l1_gas: {
                max_amount: string;
                max_price_per_unit: string;
            };
            l2_gas: {
                max_amount: string;
                max_price_per_unit: string;
            };
        };
        tip: string;
        paymasterData: any[];
        nonceDataAvailabilityMode: "L1" | "L2";
        feeDataAvailabilityMode: "L1" | "L2";
    };
}
