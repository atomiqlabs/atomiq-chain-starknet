import {StarknetBase, StarknetRetryPolicy} from "../base/StarknetBase";
import {constants, Contract, Provider, TypedContractV2} from "starknet";
import {StarknetFees} from "../base/modules/StarknetFees";
import {Abi} from "abi-wan-kanabi";
import {StarknetContractEvents} from "./modules/StarknetContractEvents";

/**
 * Base class providing program specific utilities
 */
export class StarknetContractBase<T extends Abi> extends StarknetBase {

    contract: TypedContractV2<T>;

    public readonly Events: StarknetContractEvents<T>;

    constructor(
        chainId: constants.StarknetChainId,
        provider: Provider,
        contractAddress: string,
        contractAbi: T,
        retryPolicy?: StarknetRetryPolicy,
        solanaFeeEstimator: StarknetFees = new StarknetFees(provider)
    ) {
        super(chainId, provider, retryPolicy, solanaFeeEstimator);
        const contract = new Contract(contractAbi, contractAddress, provider).typedv2(contractAbi);
        this.Events = new StarknetContractEvents(this);
    }

}
