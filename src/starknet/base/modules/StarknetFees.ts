import {getLogger, toHex} from "../../../utils/Utils";
import * as BN from "bn.js";
import {Provider, UniversalDetails} from "starknet";

const MAX_FEE_AGE = 5000;

export class StarknetFees {

    private readonly logger = getLogger("StarknetFees: ");

    private readonly feeDA: "L1" | "L2";
    private readonly nonceDA: "L1" | "L2";
    private readonly provider: Provider;
    private readonly gasToken: "ETH" | "STRK";
    private readonly maxFeeRate: BN;

    private blockFeeCache: {
        timestamp: number,
        feeRate: Promise<BN>
    } = null;

    constructor(
        provider: Provider,
        gasToken: "ETH" | "STRK" = "ETH",
        maxFeeRate: number = gasToken==="ETH" ? 100_000_000_000 /*100 GWei*/ : 1_000_000_000_000_000 /*100 * 10000 GWei*/,
        da?: {fee?: "L1" | "L2", nonce?: "L1" | "L2"}
    ) {
        this.provider = provider;
        this.gasToken = gasToken;
        this.maxFeeRate = new BN(maxFeeRate);
        this.feeDA = da?.fee ?? "L1";
        this.nonceDA = da?.nonce ?? "L1";
    }

    /**
     * Gets starknet fee rate
     *
     * @private
     * @returns {Promise<BN>} L1 gas price denominated in Wei
     */
    private async _getFeeRate(): Promise<BN> {
        //TODO: Add support for STRK fees (v3 txns), getL1GasPrice uses starknet_getBlockWithTxHashes underneath
        // the raw call also returns the gas price in STRK
        if(this.gasToken!=="ETH") throw new Error("Getting fees for v3 txns is not supported");
        const l1GasCost = new BN(await this.provider.getL1GasPrice());

        this.logger.debug("_getFeeRate(): L1 fee rate: "+l1GasCost.toString(10));

        return l1GasCost;
    }

    /**
     * Gets the gas price with caching, format: <gas price in Wei>;<transaction version: v2/v3>
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

        const feeRate = BN.min(await this.blockFeeCache.feeRate, this.maxFeeRate);
        const fee = feeRate.toString(10)+";"+(this.gasToken === "ETH" ? "v2" : "v3");

        this.logger.debug("getFeeRate(): calculated fee: "+fee);

        return fee;
    }

    /**
     * Calculates the total gas fee fee paid for a given gas limit at a given fee rate
     *
     * @param gas
     * @param feeRate
     */
    public static getGasFee(gas: number, feeRate: string): BN {
        if(feeRate==null) return new BN(0);

        const arr = feeRate.split(";");
        const gasPrice = new BN(arr[0]);

        return gasPrice.mul(new BN(gas));
    }

    getFeeDetails(L1GasLimit: number, L2GasLimit: number, feeRate: string) {
        if(feeRate==null) return null;

        const arr = feeRate.split(";");
        const gasPrice = BigInt(arr[0]);
        const version = arr[1] as "v2" | "v3";

        const maxFee = toHex(BigInt(L1GasLimit) * gasPrice);

        return {
            maxFee: maxFee,
            version: version==="v2" ? "0x2" : "0x3" as "0x2" | "0x3",
            resourceBounds: {
                l1_gas: {max_amount: toHex(L1GasLimit), max_price_per_unit: maxFee},
                l2_gas: {max_amount: "0x0", max_price_per_unit: "0x0"}
            },
            tip: "0x0",
            paymasterData: [],
            nonceDataAvailabilityMode: this.nonceDA,
            feeDataAvailabilityMode: this.feeDA
        }
    }

}