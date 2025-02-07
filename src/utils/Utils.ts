import * as BN from "bn.js";
import {EDAMode} from "starknet-types-07";
import {BigNumberish, cairo, CallData, hash, Uint256} from "starknet";
import {StarknetTx} from "../starknet/base/modules/StarknetTransactions";
import {Buffer} from "buffer";

export function isUint256(val: any): val is Uint256 {
    return val.low!=null && val.high!=null;
}

export function timeoutPromise(timeoutMillis: number, abortSignal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, timeoutMillis)
        if(abortSignal!=null) abortSignal.addEventListener("abort", () => {
            clearTimeout(timeout);
            reject(new Error("Aborted"));
        })
    });
}

export function onceAsync<T>(executor: () => Promise<T>): () => Promise<T> {
    let promise: Promise<T>;

    return () => {
        if(promise==null) {
            promise = executor();
            return promise;
        } else {
            return promise.catch(() => promise = executor());
        }
    }
}

export function getLogger(prefix: string) {
    return {
        debug: (msg, ...args) => console.debug(prefix+msg, ...args),
        info: (msg, ...args) => console.info(prefix+msg, ...args),
        warn: (msg, ...args) => console.warn(prefix+msg, ...args),
        error: (msg, ...args) => console.error(prefix+msg, ...args)
    };
}

const logger = getLogger("Utils: ");

export async function tryWithRetries<T>(func: () => Promise<T>, retryPolicy?: {
    maxRetries?: number, delay?: number, exponential?: boolean
}, errorAllowed?: (e: any) => boolean, abortSignal?: AbortSignal): Promise<T> {
    retryPolicy = retryPolicy || {};
    retryPolicy.maxRetries = retryPolicy.maxRetries || 5;
    retryPolicy.delay = retryPolicy.delay || 500;
    retryPolicy.exponential =  retryPolicy.exponential==null ? true : retryPolicy.exponential;

    let err = null;

    for(let i=0;i<retryPolicy.maxRetries;i++) {
        try {
            const resp: T = await func();
            return resp;
        } catch (e) {
            if(errorAllowed!=null && errorAllowed(e)) throw e;
            err = e;
            logger.error("tryWithRetries(): error on try number: "+i, e);
        }
        if(abortSignal!=null && abortSignal.aborted) throw new Error("Aborted");
        if(i!==retryPolicy.maxRetries-1) {
            await timeoutPromise(
                retryPolicy.exponential ? retryPolicy.delay*Math.pow(2, i) : retryPolicy.delay,
                abortSignal
            );
        }
    }

    throw err;
}

export function toBigInt(value: BN): bigint {
    if(value==null) return null;
    return BigInt("0x"+value.toString("hex"));
}

export function toHex(value: BN | number | bigint | string): string {
    if(value==null) return null;
    if(typeof(value)==="string") {
        if(value.startsWith("0x")) return value;
        return "0x"+BigInt(value).toString(16);
    }
    return "0x"+value.toString(16);
}

export function calculateHash(tx: StarknetTx): string {
    const commonData = {
        version: tx.details.version,
        maxFee: tx.details.maxFee,
        chainId: tx.details.chainId,
        nonce: tx.details.nonce,
        accountDeploymentData: tx.details.version==="0x3" ? tx.details.accountDeploymentData : null,
        nonceDataAvailabilityMode: tx.details.version==="0x3" ? EDAMode[tx.details.nonceDataAvailabilityMode] : null,
        feeDataAvailabilityMode: tx.details.version==="0x3" ? EDAMode[tx.details.feeDataAvailabilityMode] : null,
        resourceBounds: tx.details.version==="0x3" ? tx.details.resourceBounds : null,
        tip: tx.details.version==="0x3" ? tx.details.tip : null,
        paymasterData: tx.details.version==="0x3" ? tx.details.paymasterData : null
    };
    switch(tx.type) {
        case "INVOKE":
            const invokeData = CallData.compile(tx.signed.calldata);
            return tx.txId = hash.calculateInvokeTransactionHash({
                senderAddress: tx.details.walletAddress,
                compiledCalldata: invokeData,
                ...commonData
            });
        case "DEPLOY_ACCOUNT":
            const deployAccountData = CallData.compile(tx.signed.constructorCalldata);
            return tx.txId = hash.calculateDeployAccountTransactionHash({
                contractAddress: tx.tx.contractAddress,
                classHash: tx.signed.classHash,
                constructorCalldata: deployAccountData,
                compiledConstructorCalldata: deployAccountData,
                salt: tx.signed.addressSalt,
                ...commonData
            });
        default:
            throw new Error("Unsupported tx type!");
    }
}

export function u32ArrayToBuffer(arr: BigNumberish[]): Buffer {
    const buffer = Buffer.alloc(4*arr.length);
    for(let i=0;i<arr.length;i++) {
        buffer.writeUInt32BE(Number(arr[i]), i*4);
    }
    return buffer;
}

export function bufferToU32Array(buffer: Buffer): number[] {
    const result: number[] = [];
    for(let i=0;i<buffer.length;i+=4) {
        result.push(buffer.readUInt32BE(i));
    }
    return result;
}

export function u32ReverseEndianness(value: number) {
    return ((value & 0xFF) << 24)
        | ((value & 0xFF00) << 8)
        | ((value >> 8) & 0xFF00)
        | ((value >> 24) & 0xFF);
}

export function bigNumberishToBuffer(value: BigNumberish | Uint256, length: number): Buffer {
    if(isUint256(value)) {
        return Buffer.concat([bigNumberishToBuffer(value.high, 16), bigNumberishToBuffer(value.low, 16)])
    }
    let str = value.toString(16);
    if(str.startsWith("0x")) str = str.slice(2);
    const buff = Buffer.from(str, "hex");
    if(buff.length >= length) return buff;
    const paddedBuffer = Buffer.alloc(length);
    buff.copy(paddedBuffer, paddedBuffer.length-buff.length);
    return paddedBuffer;
}

export function toBN(value: BigNumberish | Uint256) {
    if(isUint256(value)) {
        return new BN(value.high.toString(10)).shln(128).or(new BN(value.low.toString(10)));
    }
    return new BN(value.toString(10));
}

export function bufferToBytes31Span(buffer: Buffer, startIndex: number = 0, endIndex: number = buffer.length): BigNumberish[] {
    const values: BigNumberish[] = [];
    for(let i=startIndex+31;i<endIndex;i+=31) {
        values.push(BigInt("0x"+buffer.subarray(i-31, i).toString("hex")));
    }
    if(endIndex > startIndex + (values.length*31)) values.push(BigInt("0x"+buffer.subarray(startIndex + (values.length*31), endIndex).toString("hex")));
    return values;
}

export function bufferToByteArray(buffer: Buffer, startIndex: number = 0, endIndex: number = buffer.length): BigNumberish[] {
    const values: BigNumberish[] = [];
    for(let i=startIndex+31;i<endIndex;i+=31) {
        values.push(BigInt("0x"+buffer.subarray(i-31, i).toString("hex")));
    }
    let pendingWord: BigNumberish = BigInt(0);
    let pendingWordLen: BigNumberish = BigInt(endIndex - (startIndex + (values.length*31)));
    if(pendingWordLen !== BigInt(0)) {
        pendingWord = BigInt("0x"+buffer.subarray(startIndex + (values.length*31), endIndex).toString("hex"));
    }
    return [
        BigInt(values.length),
        ...values,
        pendingWord,
        pendingWordLen
    ];
}

export function poseidonHashRange(buffer: Buffer, startIndex: number = 0, endIndex: number = buffer.length): BigNumberish {
    return hash.computePoseidonHashOnElements(bufferToBytes31Span(buffer, startIndex, endIndex));
}
