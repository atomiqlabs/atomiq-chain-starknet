"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RpcProviderWithRetries = void 0;
const starknet_1 = require("starknet");
const Utils_1 = require("../../utils/Utils");
class RpcProviderWithRetries extends starknet_1.RpcProvider {
    constructor(options, retryPolicy) {
        super(options);
        this.retryPolicy = retryPolicy;
    }
    fetch(method, params, id) {
        return (0, Utils_1.tryWithRetries)(() => super.fetch(method, params, id), this.retryPolicy, e => {
            if (!(e instanceof starknet_1.RpcError))
                return false;
            if (e.baseError.code < 0)
                return false; //Not defined error, e.g. Rate limit (-32097)
            return true;
        });
    }
}
exports.RpcProviderWithRetries = RpcProviderWithRetries;
