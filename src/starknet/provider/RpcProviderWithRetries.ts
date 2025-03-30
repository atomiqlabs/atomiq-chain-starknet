import {ProviderInterface, RpcError, RpcProvider, RpcProviderOptions} from "starknet";
import {tryWithRetries} from "../../utils/Utils";


export class RpcProviderWithRetries extends RpcProvider {

    readonly retryPolicy?: {
        maxRetries?: number, delay?: number, exponential?: boolean
    };

    constructor(options?: RpcProviderOptions | ProviderInterface, retryPolicy?: {
        maxRetries?: number, delay?: number, exponential?: boolean
    }) {
        super(options);
        this.retryPolicy = retryPolicy;
    }

    fetch(method: string, params?: object, id?: string | number): Promise<Response> {
        return tryWithRetries(() => super.fetch(method, params, id), this.retryPolicy, e => {
            if(!(e instanceof RpcError)) return false;
            if(e.baseError.code<0) return false; //Not defined error, e.g. Rate limit (-32097)
            return true;
        });
    }

}
