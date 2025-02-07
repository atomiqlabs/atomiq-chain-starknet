"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimelockRefundHandler = void 0;
const Utils_1 = require("../../../../utils/Utils");
class TimelockRefundHandler {
    getCommitment(data) {
        return (0, Utils_1.toBigInt)(data);
    }
    getWitness(signer, data) {
        const expiry = TimelockRefundHandler.getExpiry(data);
        const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
        if (expiry > currentTimestamp)
            throw new Error("Not expired yet!");
        return Promise.resolve({ initialTxns: [], witness: [] });
    }
    getGas() {
        return TimelockRefundHandler.gas;
    }
    static getExpiry(data) {
        if (!data.isRefundHandler(TimelockRefundHandler.address))
            throw new Error("Invalid refund handler");
        return (0, Utils_1.bigNumberishToBuffer)(data.refundData, 32).readBigUInt64BE(24);
    }
}
exports.TimelockRefundHandler = TimelockRefundHandler;
TimelockRefundHandler.address = "";
TimelockRefundHandler.gas = { l1: 500 };
