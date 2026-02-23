import {
    RPC09, RPC010,
    RpcProvider,
    RpcProviderOptions
} from "starknet";
import {tryWithRetries} from "../../utils/Utils";

/**
 * @private
 */
export class Rpc09ChannelWithRetries extends RPC09.RpcChannel {

    private readonly retryPolicy?: {
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
            if(!e.message.startsWith("RPC: ")) return false;
            if(e.message.includes("Unsupported method")) return true;
            const arr = e.message.split("\n");
            const errorCode = parseInt(arr[arr.length-1]);
            if(isNaN(errorCode)) return false;
            if(errorCode < 0) return false; //Not defined error, e.g. Rate limit (-32097)
            return true;
        });
    }

}

/**
 * @private
 */
export class Rpc010ChannelWithRetries extends RPC010.RpcChannel {

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
            if(!e.message.startsWith("RPC: ")) return false;
            if(e.message.includes("Unsupported method")) return true;
            const arr = e.message.split("\n");
            const errorCode = parseInt(arr[arr.length-1]);
            if(isNaN(errorCode)) return false;
            if(errorCode < 0) return false; //Not defined error, e.g. Rate limit (-32097)
            return true;
        });
    }

}

/**
 * An RPC provider with built-in retry functionality, retries calls to the RPC service on failure
 *
 * @category Providers
 */
export class RpcProviderWithRetries extends RpcProvider {

    /**
     * Creates a new RPC provider which retries RPC calls on failure, controlled by the passed `retryPolicy`
     * NOTE: Tries to do naive detection of the spec version based on the suffix of nodeUrl, better pass the `options.specVersion`
     *  in the options!
     *
     * @param options
     * @param retryPolicy
     */
    constructor(options?: RpcProviderOptions, retryPolicy?: {
        maxRetries?: number, delay?: number, exponential?: boolean
    }) {
        options ??= {};
        if(options.specVersion==null) {
            // Default to RPC 0.10.0 (starknetjs v9 default), fallback to 0.9.0 if URL indicates v0_9
            if(options.nodeUrl?.endsWith("v0_9")) {
                (options as any).specVersion = "0.9.0";
            } else {
                // Default to 0.10.0 for v9
                (options as any).specVersion = "0.10.0";
            }
        }
        super(options);
        const channelId = this.channel.id as string;
        if(channelId==="RPC090") {
            this.channel = new Rpc09ChannelWithRetries({ ...options, waitMode: false }, retryPolicy);
        } else if(channelId==="RPC0100" || channelId==="RPC010" || channelId==="RPC0.10.0" || (channelId && !channelId.startsWith("RPC08"))) {
            // Handle RPC 0.10 (default in starknetjs v9) - channel ID might be "RPC0100", "RPC010", or other format
            // Also handle any non-RPC08/RPC09 channel as RPC 0.10
            this.channel = new Rpc010ChannelWithRetries({ ...options, waitMode: false }, retryPolicy);
        }
    }

}
