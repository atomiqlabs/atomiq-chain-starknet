import { RPC09, RPC010, RpcProvider, RpcProviderOptions } from "starknet";
/**
 * @private
 */
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
/**
 * @private
 */
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
 * An RPC provider with built-in retry functionality, retries calls to the RPC service on failure
 *
 * @category Providers
 */
export declare class RpcProviderWithRetries extends RpcProvider {
    /**
     * Creates a new RPC provider which retries RPC calls on failure, controlled by the passed `retryPolicy`
     * NOTE: Tries to do naive detection of the spec version based on the suffix of nodeUrl, better pass the `options.specVersion`
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
