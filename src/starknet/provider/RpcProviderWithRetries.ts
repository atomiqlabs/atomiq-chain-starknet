import {
    RpcChannel,
    RpcError,
    RpcProvider,
    RpcProviderOptions
} from "starknet";
import {tryWithRetries} from "../../utils/Utils";

export class RpcChannelWithRetries extends RpcChannel {

    readonly retryPolicy?: {
        maxRetries?: number, delay?: number, exponential?: boolean
    };

    constructor(options?: RpcProviderOptions, retryPolicy?: {
        maxRetries?: number, delay?: number, exponential?: boolean
    }) {
        super(options);
        this.retryPolicy = retryPolicy;
    }

    protected fetchEndpoint(method: any, params?: any): Promise<any> {
        return tryWithRetries(() => super.fetchEndpoint(method, params), this.retryPolicy, e => {
            if(!(e instanceof RpcError)) return false;
            if(e.baseError.code<0) return false; //Not defined error, e.g. Rate limit (-32097)
            return true;
        });
    }

}

export class RpcProviderWithRetries extends RpcProvider {

    constructor(options?: RpcProviderOptions, retryPolicy?: {
        maxRetries?: number, delay?: number, exponential?: boolean
    }) {
        super(options);
        this.channel = new RpcChannelWithRetries({ ...options, waitMode: false }, retryPolicy);
    }

}
