import { RPC09, RPC010, RpcProvider, RpcProviderOptions } from "starknet";
export declare class Rpc09ChannelWithRetries extends RPC09.RpcChannel {
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
export declare class Rpc010ChannelWithRetries extends RPC010.RpcChannel {
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
/**
 * @category Providers
 */
export declare class RpcProviderWithRetries extends RpcProvider {
    /**
     * Tries to do naive detection of the spec version based on the suffix of nodeUrl, better pass the `specVersion`
     *  in the options!
     *
     * @param options
     * @param retryPolicy
     */
    constructor(options?: RpcProviderOptions, retryPolicy?: {
        maxRetries?: number;
        delay?: number;
        exponential?: boolean;
    });
}
