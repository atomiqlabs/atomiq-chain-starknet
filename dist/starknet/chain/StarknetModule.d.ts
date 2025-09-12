import { Provider } from "starknet";
import { StarknetChainInterface, StarknetRetryPolicy } from "./StarknetChainInterface";
export declare class StarknetModule {
    protected readonly provider: Provider;
    protected readonly retryPolicy?: StarknetRetryPolicy;
    protected readonly root: StarknetChainInterface;
    protected readonly logger: {
        debug: (msg: any, ...args: any[]) => false | void;
        info: (msg: any, ...args: any[]) => false | void;
        warn: (msg: any, ...args: any[]) => false | void;
        error: (msg: any, ...args: any[]) => false | void;
    };
    constructor(root: StarknetChainInterface);
}
