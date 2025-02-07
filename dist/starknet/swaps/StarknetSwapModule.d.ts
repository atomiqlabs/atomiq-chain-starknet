import { StarknetModule } from "../base/StarknetModule";
import { StarknetSwapContract } from "./StarknetSwapContract";
import { TypedContractV2 } from "starknet";
import { EscrowManagerAbi } from "./EscrowManagerAbi";
export declare class StarknetSwapModule extends StarknetModule {
    readonly root: StarknetSwapContract;
    readonly contract: TypedContractV2<typeof EscrowManagerAbi>;
    constructor(root: StarknetSwapContract);
}
