"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RpcProviderWithRetries = exports.RpcChannelWithRetries = void 0;
const starknet_1 = require("starknet");
const Utils_1 = require("../../utils/Utils");
class RpcChannelWithRetries extends starknet_1.RpcChannel {
    constructor(options, retryPolicy) {
        super(options);
        this.retryPolicy = retryPolicy;
    }
    fetchEndpoint(method, params) {
        return (0, Utils_1.tryWithRetries)(() => super.fetchEndpoint(method, params), this.retryPolicy, e => {
            if (!e.message.startsWith("RPC: "))
                return false;
            const arr = e.message.split("\n");
            const errorCode = parseInt(arr[arr.length - 1]);
            if (isNaN(errorCode))
                return false;
            if (errorCode < 0)
                return false; //Not defined error, e.g. Rate limit (-32097)
            return true;
        });
    }
}
exports.RpcChannelWithRetries = RpcChannelWithRetries;
class RpcProviderWithRetries extends starknet_1.RpcProvider {
    constructor(options, retryPolicy) {
        super(options);
        this.channel = new RpcChannelWithRetries({ ...options, waitMode: false }, retryPolicy);
    }
}
exports.RpcProviderWithRetries = RpcProviderWithRetries;
