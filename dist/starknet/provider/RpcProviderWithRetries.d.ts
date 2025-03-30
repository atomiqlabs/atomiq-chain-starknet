import { ProviderInterface, RpcProvider, RpcProviderOptions } from "starknet";
export declare class RpcProviderWithRetries extends RpcProvider {
    readonly retryPolicy?: {
        maxRetries?: number;
        delay?: number;
        exponential?: boolean;
    };
    constructor(options?: RpcProviderOptions | ProviderInterface, retryPolicy?: {
        maxRetries?: number;
        delay?: number;
        exponential?: boolean;
    });
    fetch(method: string, params?: object, id?: string | number): Promise<Response>;
}
