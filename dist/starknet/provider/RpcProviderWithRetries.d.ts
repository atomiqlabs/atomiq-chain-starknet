import { RpcChannel, RpcProvider, RpcProviderOptions } from "starknet";
export declare class RpcChannelWithRetries extends RpcChannel {
    readonly retryPolicy?: {
        maxRetries?: number;
        delay?: number;
        exponential?: boolean;
    };
    constructor(options?: RpcProviderOptions, retryPolicy?: {
        maxRetries?: number;
        delay?: number;
        exponential?: boolean;
    });
    protected fetchEndpoint(method: any, params?: any): Promise<any>;
}
export declare class RpcProviderWithRetries extends RpcProvider {
    constructor(options?: RpcProviderOptions, retryPolicy?: {
        maxRetries?: number;
        delay?: number;
        exponential?: boolean;
    });
}
