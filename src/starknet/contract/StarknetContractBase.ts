import {StarknetChainInterface} from "../chain/StarknetChainInterface";
import {Contract, TypedContractV2} from "starknet";
import {Abi} from "abi-wan-kanabi";
import {StarknetContractEvents} from "./modules/StarknetContractEvents";

/**
 * Base class providing program specific utilities
 */
export class StarknetContractBase<T extends Abi> {

    readonly contract: TypedContractV2<T>;

    /**
     * @internal
     */
    readonly _Events: StarknetContractEvents<T>;
    /**
     * @internal
     */
    protected readonly Chain: StarknetChainInterface;
    /**
     * @internal
     */
    readonly _contractDeploymentHeight?: number;

    constructor(
        chainInterface: StarknetChainInterface,
        contractAddress: string,
        contractAbi: T,
        contractDeploymentHeight?: number
    ) {
        this.Chain = chainInterface;
        this.contract = new Contract({
            abi: contractAbi,
            address: contractAddress,
            providerOrAccount: chainInterface.provider
        }).typedv2(contractAbi);
        this._Events = new StarknetContractEvents(chainInterface, this, contractAbi);
        this._contractDeploymentHeight = contractDeploymentHeight;
    }

}
