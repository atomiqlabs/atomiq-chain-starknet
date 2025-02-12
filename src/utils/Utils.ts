import * as BN from "bn.js";
import {EDAMode} from "starknet-types-07";
import {BigNumberish, CallData, hash, Uint256} from "starknet";
import {StarknetTx} from "../starknet/base/modules/StarknetTransactions";
import {Buffer} from "buffer";
import {StarknetSwapData} from "../starknet/swaps/StarknetSwapData";
import {IClaimHandler} from "../starknet/swaps/handlers/claim/ClaimHandlers";

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

export function toHex(value: BN | number | bigint | string | Buffer, length: number = 64): string {
    if(value==null) return null;
    switch(typeof(value)) {
        case "string":
            if(value.startsWith("0x")) {
                return "0x"+value.slice(2).padStart(length, "0");
            } else {
                return "0x"+BigInt(value).toString(16).padStart(length, "0");
            }
        case "number":
        case "bigint":
            return "0x"+value.toString(16).padStart(length, "0");
    }
    if(BN.isBN(value)) {
        return "0x"+value.toString("hex").padStart(length, "0");
    }
    return "0x"+value.toString("hex").padStart(length, "0");
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

export function u32ReverseEndianness(value: number): number {
    const valueBN = new BN(value);
    return valueBN.and(new BN(0xFF)).shln(24)
        .or(valueBN.and(new BN(0xFF00)).shln(8))
        .or(valueBN.shrn(8).and(new BN(0xFF00)))
        .or(valueBN.shrn(24).and(new BN(0xFF)))
        .toNumber();
}

export function bigNumberishToBuffer(value: BigNumberish | Uint256, length: number): Buffer {
    if(isUint256(value)) {
        return Buffer.concat([bigNumberishToBuffer(value.high, 16), bigNumberishToBuffer(value.low, 16)])
    }
    if(typeof(value)==="string") {
        if(value.startsWith("0x")) {
            value = value.slice(2);
        } else {
            value = BigInt(value).toString(16);
        }
    } else {
        value = value.toString(16);
    }
    const buff = Buffer.from(value.padStart(length*2, "0"), "hex");
    if(buff.length > length) return buff.subarray(buff.length-length);
    return buff;
}

export function toBN(value: BigNumberish | Uint256) {
    if(isUint256(value)) {
        return toBN(value.high).shln(128).or(toBN(value.low));
    }
    if(typeof(value)==="string") {
        if(value.startsWith("0x")) value = value.slice(2);
        return new BN(value, "hex");
    }
    return new BN(value.toString(10));
}

export function bytes31SpanToBuffer(span: BigNumberish[], length: number): Buffer {
    const buffers: Buffer[] = [];
    const numFullBytes31 = Math.floor(length/31);
    const additionalBytes = length - (numFullBytes31*31);
    const requiredSpanLength = numFullBytes31 + (additionalBytes===0 ? 0 : 1);
    if(span.length<requiredSpanLength) throw new Error("Not enough bytes in the felt array!");
    let i = 0;
    for(; i<numFullBytes31; i++) {
        buffers.push(bigNumberishToBuffer(span[i], 31));
    }
    if(additionalBytes!==0) buffers.push(bigNumberishToBuffer(span[i], additionalBytes));
    return Buffer.concat(buffers);
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

export function parseInitFunctionCalldata(calldata: BigNumberish[], claimHandler: IClaimHandler<any, any>): {escrow: StarknetSwapData, signature: BigNumberish[], timeout: BN, extraData: BigNumberish[]} {
    const escrow = StarknetSwapData.fromSerializedFeltArray(calldata, claimHandler);
    const signatureLen = toBN(calldata.shift()).toNumber();
    const signature = calldata.splice(0, signatureLen);
    const timeout = toBN(calldata.shift());
    const extraDataLen = toBN(calldata.shift()).toNumber();
    const extraData = calldata.splice(0, extraDataLen);
    if(calldata.length!==0) throw new Error("Calldata not read fully!");
    return {escrow, signature, timeout, extraData};
}

export function findLastIndex<T>(array: T[], callback: (value: T, index: number) => boolean): number {
    for(let i=array.length-1;i>=0;i--){
        if(callback(array[i], i)) return i;
    }
    return -1;
}
