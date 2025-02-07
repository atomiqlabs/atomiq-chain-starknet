import {StarknetModule} from "../base/StarknetModule";
import {StarknetSwapContract} from "./StarknetSwapContract";
import {TypedContractV2} from "starknet";
import {EscrowManagerAbi} from "./EscrowManagerAbi";

export class StarknetSwapModule extends StarknetModule {

    readonly root: StarknetSwapContract;
    readonly contract: TypedContractV2<typeof EscrowManagerAbi>;

    constructor(root: StarknetSwapContract) {
        super(root);
        this.root = root;
        this.contract = root.contract;
    }

}
