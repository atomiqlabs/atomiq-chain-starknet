"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseInitFunctionCalldata = exports.poseidonHashRange = exports.bufferToByteArray = exports.bufferToBytes31Span = exports.bytes31SpanToBuffer = exports.toBN = exports.bigNumberishToBuffer = exports.u32ReverseEndianness = exports.bufferToU32Array = exports.u32ArrayToBuffer = exports.calculateHash = exports.toHex = exports.toBigInt = exports.tryWithRetries = exports.getLogger = exports.onceAsync = exports.timeoutPromise = exports.isUint256 = void 0;
const BN = require("bn.js");
const starknet_types_07_1 = require("starknet-types-07");
const starknet_1 = require("starknet");
const buffer_1 = require("buffer");
const StarknetSwapData_1 = require("../starknet/swaps/StarknetSwapData");
function isUint256(val) {
    return val.low != null && val.high != null;
}
exports.isUint256 = isUint256;
function timeoutPromise(timeoutMillis, abortSignal) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, timeoutMillis);
        if (abortSignal != null)
            abortSignal.addEventListener("abort", () => {
                clearTimeout(timeout);
                reject(new Error("Aborted"));
            });
    });
}
exports.timeoutPromise = timeoutPromise;
function onceAsync(executor) {
    let promise;
    return () => {
        if (promise == null) {
            promise = executor();
            return promise;
        }
        else {
            return promise.catch(() => promise = executor());
        }
    };
}
exports.onceAsync = onceAsync;
function getLogger(prefix) {
    return {
        debug: (msg, ...args) => console.debug(prefix + msg, ...args),
        info: (msg, ...args) => console.info(prefix + msg, ...args),
        warn: (msg, ...args) => console.warn(prefix + msg, ...args),
        error: (msg, ...args) => console.error(prefix + msg, ...args)
    };
}
exports.getLogger = getLogger;
const logger = getLogger("Utils: ");
function tryWithRetries(func, retryPolicy, errorAllowed, abortSignal) {
    return __awaiter(this, void 0, void 0, function* () {
        retryPolicy = retryPolicy || {};
        retryPolicy.maxRetries = retryPolicy.maxRetries || 5;
        retryPolicy.delay = retryPolicy.delay || 500;
        retryPolicy.exponential = retryPolicy.exponential == null ? true : retryPolicy.exponential;
        let err = null;
        for (let i = 0; i < retryPolicy.maxRetries; i++) {
            try {
                const resp = yield func();
                return resp;
            }
            catch (e) {
                if (errorAllowed != null && errorAllowed(e))
                    throw e;
                err = e;
                logger.error("tryWithRetries(): error on try number: " + i, e);
            }
            if (abortSignal != null && abortSignal.aborted)
                throw new Error("Aborted");
            if (i !== retryPolicy.maxRetries - 1) {
                yield timeoutPromise(retryPolicy.exponential ? retryPolicy.delay * Math.pow(2, i) : retryPolicy.delay, abortSignal);
            }
        }
        throw err;
    });
}
exports.tryWithRetries = tryWithRetries;
function toBigInt(value) {
    if (value == null)
        return null;
    return BigInt("0x" + value.toString("hex"));
}
exports.toBigInt = toBigInt;
function toHex(value) {
    if (value == null)
        return null;
    switch (typeof (value)) {
        case "string":
            return "0x" + BigInt(value).toString(16).padStart(64, "0");
        case "number":
        case "bigint":
            return "0x" + value.toString(16).padStart(64, "0");
    }
    if (BN.isBN(value)) {
        return "0x" + value.toString("hex").padStart(64, "0");
    }
    return "0x" + value.toString("hex").padStart(64, "0");
}
exports.toHex = toHex;
function calculateHash(tx) {
    const commonData = {
        version: tx.details.version,
        maxFee: tx.details.maxFee,
        chainId: tx.details.chainId,
        nonce: tx.details.nonce,
        accountDeploymentData: tx.details.version === "0x3" ? tx.details.accountDeploymentData : null,
        nonceDataAvailabilityMode: tx.details.version === "0x3" ? starknet_types_07_1.EDAMode[tx.details.nonceDataAvailabilityMode] : null,
        feeDataAvailabilityMode: tx.details.version === "0x3" ? starknet_types_07_1.EDAMode[tx.details.feeDataAvailabilityMode] : null,
        resourceBounds: tx.details.version === "0x3" ? tx.details.resourceBounds : null,
        tip: tx.details.version === "0x3" ? tx.details.tip : null,
        paymasterData: tx.details.version === "0x3" ? tx.details.paymasterData : null
    };
    switch (tx.type) {
        case "INVOKE":
            const invokeData = starknet_1.CallData.compile(tx.signed.calldata);
            return tx.txId = starknet_1.hash.calculateInvokeTransactionHash(Object.assign({ senderAddress: tx.details.walletAddress, compiledCalldata: invokeData }, commonData));
        case "DEPLOY_ACCOUNT":
            const deployAccountData = starknet_1.CallData.compile(tx.signed.constructorCalldata);
            return tx.txId = starknet_1.hash.calculateDeployAccountTransactionHash(Object.assign({ contractAddress: tx.tx.contractAddress, classHash: tx.signed.classHash, constructorCalldata: deployAccountData, compiledConstructorCalldata: deployAccountData, salt: tx.signed.addressSalt }, commonData));
        default:
            throw new Error("Unsupported tx type!");
    }
}
exports.calculateHash = calculateHash;
function u32ArrayToBuffer(arr) {
    const buffer = buffer_1.Buffer.alloc(4 * arr.length);
    for (let i = 0; i < arr.length; i++) {
        buffer.writeUInt32BE(Number(arr[i]), i * 4);
    }
    return buffer;
}
exports.u32ArrayToBuffer = u32ArrayToBuffer;
function bufferToU32Array(buffer) {
    const result = [];
    for (let i = 0; i < buffer.length; i += 4) {
        result.push(buffer.readUInt32BE(i));
    }
    return result;
}
exports.bufferToU32Array = bufferToU32Array;
function u32ReverseEndianness(value) {
    return ((value & 0xFF) << 24)
        | ((value & 0xFF00) << 8)
        | ((value >> 8) & 0xFF00)
        | ((value >> 24) & 0xFF);
}
exports.u32ReverseEndianness = u32ReverseEndianness;
function bigNumberishToBuffer(value, length) {
    if (isUint256(value)) {
        return buffer_1.Buffer.concat([bigNumberishToBuffer(value.high, 16), bigNumberishToBuffer(value.low, 16)]);
    }
    let str = value.toString(16);
    if (str.startsWith("0x"))
        str = str.slice(2);
    const buff = buffer_1.Buffer.from(str, "hex");
    if (buff.length >= length)
        return buff.subarray(buff.length - length);
    const paddedBuffer = buffer_1.Buffer.alloc(length);
    buff.copy(paddedBuffer, paddedBuffer.length - buff.length);
    return paddedBuffer;
}
exports.bigNumberishToBuffer = bigNumberishToBuffer;
function toBN(value) {
    if (isUint256(value)) {
        return new BN(value.high.toString(10)).shln(128).or(new BN(value.low.toString(10)));
    }
    if (typeof (value) === "string") {
        if (value.startsWith("0x"))
            value = value.slice(2);
        return new BN(value, "hex");
    }
    return new BN(value.toString(10));
}
exports.toBN = toBN;
function bytes31SpanToBuffer(span, length) {
    const buffers = [];
    const numFullBytes31 = Math.floor(length / 31);
    const additionalBytes = length - (numFullBytes31 * 31);
    const requiredSpanLength = numFullBytes31 + (additionalBytes === 0 ? 0 : 1);
    if (span.length < requiredSpanLength)
        throw new Error("Not enough bytes in the felt array!");
    let i = 0;
    for (; i < numFullBytes31; i++) {
        buffers.push(bigNumberishToBuffer(span[i], 31));
    }
    if (additionalBytes !== 0)
        buffers.push(bigNumberishToBuffer(span[i], additionalBytes));
    return buffer_1.Buffer.concat(buffers);
}
exports.bytes31SpanToBuffer = bytes31SpanToBuffer;
function bufferToBytes31Span(buffer, startIndex = 0, endIndex = buffer.length) {
    const values = [];
    for (let i = startIndex + 31; i < endIndex; i += 31) {
        values.push(BigInt("0x" + buffer.subarray(i - 31, i).toString("hex")));
    }
    if (endIndex > startIndex + (values.length * 31))
        values.push(BigInt("0x" + buffer.subarray(startIndex + (values.length * 31), endIndex).toString("hex")));
    return values;
}
exports.bufferToBytes31Span = bufferToBytes31Span;
function bufferToByteArray(buffer, startIndex = 0, endIndex = buffer.length) {
    const values = [];
    for (let i = startIndex + 31; i < endIndex; i += 31) {
        values.push(BigInt("0x" + buffer.subarray(i - 31, i).toString("hex")));
    }
    let pendingWord = BigInt(0);
    let pendingWordLen = BigInt(endIndex - (startIndex + (values.length * 31)));
    if (pendingWordLen !== BigInt(0)) {
        pendingWord = BigInt("0x" + buffer.subarray(startIndex + (values.length * 31), endIndex).toString("hex"));
    }
    return [
        BigInt(values.length),
        ...values,
        pendingWord,
        pendingWordLen
    ];
}
exports.bufferToByteArray = bufferToByteArray;
function poseidonHashRange(buffer, startIndex = 0, endIndex = buffer.length) {
    return starknet_1.hash.computePoseidonHashOnElements(bufferToBytes31Span(buffer, startIndex, endIndex));
}
exports.poseidonHashRange = poseidonHashRange;
function parseInitFunctionCalldata(calldata, claimHandler) {
    const escrow = StarknetSwapData_1.StarknetSwapData.fromSerializedFeltArray(calldata, claimHandler);
    const signatureLen = toBN(calldata.shift()).toNumber();
    const signature = calldata.splice(0, signatureLen);
    const timeout = toBN(calldata.shift());
    const extraDataLen = toBN(calldata.shift()).toNumber();
    const extraData = calldata.splice(0, extraDataLen);
    if (calldata.length !== 0)
        throw new Error("Calldata not read fully!");
    return { escrow, signature, timeout, extraData };
}
exports.parseInitFunctionCalldata = parseInitFunctionCalldata;
