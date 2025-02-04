import {Provider} from "starknet";
import {StarknetBase, StarknetRetryPolicy} from "./StarknetBase";
import {getLogger} from "../../utils/Utils";

export class StarknetModule {
    protected readonly provider: Provider;
    protected readonly retryPolicy: StarknetRetryPolicy;
    protected readonly root: StarknetBase;

    protected readonly logger = getLogger(this.constructor.name+": ");

    constructor(
        root: StarknetBase
    ) {
        this.provider = root.provider;
        this.retryPolicy = root.retryPolicy;
        this.root = root;
    }

}