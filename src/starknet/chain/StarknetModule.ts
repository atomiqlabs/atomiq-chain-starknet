import {Provider} from "starknet";
import {StarknetChainInterface} from "./StarknetChainInterface";
import {getLogger} from "../../utils/Utils";

export class StarknetModule {
    protected readonly provider: Provider;
    protected readonly root: StarknetChainInterface;

    protected readonly logger = getLogger(this.constructor.name+": ");

    constructor(
        root: StarknetChainInterface
    ) {
        this.provider = root.provider;
        this.root = root;
    }

}