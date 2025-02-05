import { Provider } from "starknet";
import { StarknetBase, StarknetRetryPolicy } from "./StarknetBase";
export declare class StarknetModule {
    protected readonly provider: Provider;
    protected readonly retryPolicy: StarknetRetryPolicy;
    protected readonly root: StarknetBase;
    protected readonly logger: {
        debug: (msg: any, ...args: any[]) => void;
        info: (msg: any, ...args: any[]) => void;
        warn: (msg: any, ...args: any[]) => void;
        error: (msg: any, ...args: any[]) => void;
    };
    constructor(root: StarknetBase);
}
