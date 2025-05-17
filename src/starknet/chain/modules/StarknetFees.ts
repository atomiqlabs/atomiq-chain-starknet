import {getLogger, toBigInt, toHex} from "../../../utils/Utils";
import {Provider} from "starknet";
import {StarknetTokens} from "./StarknetTokens";

const MAX_FEE_AGE = 5000;

export class StarknetFees {

    private readonly logger = getLogger("StarknetFees: ");

    private readonly feeDA: "L1" | "L2";
    private readonly nonceDA: "L1" | "L2";
    private readonly provider: Provider;
    private readonly gasToken: "ETH" | "STRK";
    private readonly maxFeeRate: bigint;
    private readonly feeMultiplierPPM: bigint;

    private blockFeeCache: {
        timestamp: number,
        feeRate: Promise<bigint>
    } = null;

    constructor(
        provider: Provider,
        gasToken: "ETH" | "STRK" = "STRK",
        maxFeeRate: number = gasToken==="ETH" ? 100_000_000_000 /*100 GWei*/ : 1_000_000_000_000_000 /*100 * 10000 GWei*/,
        feeMultiplier: number = 1.25,
        da?: {fee?: "L1" | "L2", nonce?: "L1" | "L2"}
    ) {
        this.provider = provider;
        this.gasToken = gasToken;
        this.maxFeeRate = BigInt(maxFeeRate);
        this.feeDA = da?.fee ?? "L1";
        this.nonceDA = da?.nonce ?? "L1";
        this.feeMultiplierPPM = BigInt(Math.floor(feeMultiplier*1000000));
    }

    /**
     * Gets starknet fee rate
     *
     * @private
     * @returns {Promise<BN>} L1 gas price denominated in Wei
     */
    private async _getFeeRate(): Promise<bigint> {
        const block = await this.provider.getBlockWithTxHashes("latest");
        let l1GasCost = toBigInt(this.gasToken==="ETH" ? block.l1_gas_price.price_in_wei : block.l1_gas_price.price_in_fri);
        l1GasCost = l1GasCost * this.feeMultiplierPPM / 1000000n;

        this.logger.debug("_getFeeRate(): L1 fee rate: "+l1GasCost.toString(10));

        return l1GasCost;
    }

    /**
     * Gets the gas price with caching, format: <gas price in Wei>;<transaction version: v1/v3>
     *
     * @private
     */
    public async getFeeRate(): Promise<string> {
        if(this.blockFeeCache==null || Date.now() - this.blockFeeCache.timestamp > MAX_FEE_AGE) {
            let obj = {
                timestamp: Date.now(),
                feeRate: null
            };
            obj.feeRate = this._getFeeRate().catch(e => {
                if(this.blockFeeCache===obj) this.blockFeeCache=null;
                throw e;
            });
            this.blockFeeCache = obj;
        }

        let feeRate = await this.blockFeeCache.feeRate;
        if(feeRate>this.maxFeeRate) feeRate = this.maxFeeRate;

        const fee = feeRate.toString(10)+";"+(this.gasToken === "ETH" ? "v1" : "v3");

        this.logger.debug("getFeeRate(): calculated fee: "+fee);

        return fee;
    }

    public getDefaultGasToken(): string {
        return this.gasToken==="ETH" ? StarknetTokens.ERC20_ETH : StarknetTokens.ERC20_STRK;
    }

    /**
     * Calculates the total gas fee fee paid for a given gas limit at a given fee rate
     *
     * @param gas
     * @param feeRate
     */
    public static getGasFee(gas: number, feeRate: string): bigint {
        if(feeRate==null) return 0n;

        const arr = feeRate.split(";");
        const gasPrice = BigInt(arr[0]);

        return gasPrice * BigInt(gas);
    }

    public static getGasToken(feeRate: string): string {
        if(feeRate==null) return null;

        const arr = feeRate.split(";");
        const txVersion = arr[1] as "v1" | 'v3';

        return txVersion==="v1" ? StarknetTokens.ERC20_ETH : StarknetTokens.ERC20_STRK;
    }

    getFeeDetails(L1GasLimit: number, L2GasLimit: number, feeRate: string) {
        if(feeRate==null) return null;

        const arr = feeRate.split(";");
        const gasPrice = BigInt(arr[0]);
        const version = arr[1] as "v1" | "v3";

        const maxFee = toHex(BigInt(L1GasLimit) * gasPrice, 16);

        return {
            maxFee: maxFee,
            version: version==="v1" ? "0x1" : "0x3" as "0x1" | "0x3",
            resourceBounds: {
                l1_gas: {max_amount: toHex(L1GasLimit, 16), max_price_per_unit: toHex(gasPrice, 16)},
                l2_gas: {max_amount: "0x0", max_price_per_unit: "0x0"}
            },
            tip: "0x0",
            paymasterData: [],
            nonceDataAvailabilityMode: this.nonceDA,
            feeDataAvailabilityMode: this.feeDA
        }
    }

}