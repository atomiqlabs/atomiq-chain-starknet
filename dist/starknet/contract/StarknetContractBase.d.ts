import { StarknetBase, StarknetRetryPolicy } from "../base/StarknetBase";
import { constants, Provider, TypedContractV2 } from "starknet";
import { StarknetFees } from "../base/modules/StarknetFees";
import { Abi } from "abi-wan-kanabi";
import { StarknetContractEvents } from "./modules/StarknetContractEvents";
/**
 * Base class providing program specific utilities
 */
export declare class StarknetContractBase<T extends Abi> extends StarknetBase {
    contract: TypedContractV2<T>;
    readonly Events: StarknetContractEvents<T>;
    constructor(chainId: constants.StarknetChainId, provider: Provider, contractAddress: string, contractAbi: T, retryPolicy?: StarknetRetryPolicy, solanaFeeEstimator?: StarknetFees);
}
