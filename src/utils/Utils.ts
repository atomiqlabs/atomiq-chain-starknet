import {BigNumberish, CallData, hash, Signature, Uint256, EDAMode, ResourceBounds, ResourceBoundsBN} from "starknet";
import {StarknetTx} from "../starknet/chain/modules/StarknetTransactions";
import {Buffer} from "buffer";

export type ReplaceBigInt<T> =
    T extends bigint
        ? string
        : T extends (infer U)[]
            ? ReplaceBigInt<U>[]
            : T extends readonly (infer U)[]
                ? readonly ReplaceBigInt<U>[]
                : T extends object
                    ? { [K in keyof T]: ReplaceBigInt<T[K]> }
                    : T;

export type NoBigInt = number | string | boolean | NoBigIntObject | NoBigIntArray;
type NoBigIntArray = NoBigInt[];
interface NoBigIntObject {
    [key: string]: NoBigInt;
}

export type Serialized<T> = {
    [K in keyof T as T[K] extends Function ? never : K]:
    T[K] extends infer U
        ? U extends bigint
            ? string
            : U extends object
                ? Serialized<U>
                : U
        : never;
};

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

export type LoggerType = {
    debug: (msg: string, ...args: any[]) => void,
    info: (msg: string, ...args: any[]) => void,
    warn: (msg: string, ...args: any[]) => void,
    error: (msg: string, ...args: any[]) => void,
}

export function getLogger(prefix: string): LoggerType {
    return {
        // @ts-ignore
        debug: (msg, ...args) => global.atomiqLogLevel >= 3 && console.debug(prefix+msg, ...args),
        // @ts-ignore
        info: (msg, ...args) => global.atomiqLogLevel >= 2 && console.info(prefix+msg, ...args),
        // @ts-ignore
        warn: (msg, ...args) => (global.atomiqLogLevel==null || global.atomiqLogLevel >= 1) && console.warn(prefix+msg, ...args),
        // @ts-ignore
        error: (msg, ...args) => (global.atomiqLogLevel==null || global.atomiqLogLevel >= 0) && console.error(prefix+msg, ...args)
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

export function toHex(value: number | bigint | string | Buffer, length?: number): string;
export function toHex(value: undefined | null, length?: number): null;
export function toHex(value: number | bigint | string | Buffer | undefined | null, length?: number): string | null;
export function toHex(value: number | bigint | string | Buffer | undefined | null, length: number = 64): string | null {
    if(value==null) return null;
    if(typeof(value)==="string") value = BigInt(value);
    switch(typeof(value)) {
        case "number":
        case "bigint":
            return "0x"+value.toString(16).padStart(length, "0");
    }
    return "0x"+value.toString("hex").padStart(length, "0");
}

export function calculateHash(tx: StarknetTx): string {
    if(tx.signed==null) throw new Error("Cannot calculate hash for an unsigned transaction!");
    const commonData = {
        version: tx.details.version,
        maxFee: tx.details.maxFee!,
        chainId: tx.details.chainId,
        nonce: tx.details.nonce,
        accountDeploymentData: tx.details.accountDeploymentData,
        nonceDataAvailabilityMode:EDAMode[tx.details.nonceDataAvailabilityMode],
        feeDataAvailabilityMode: EDAMode[tx.details.feeDataAvailabilityMode],
        resourceBounds: tx.details.resourceBounds,
        tip: tx.details.tip,
        paymasterData: tx.details.paymasterData
    };
    switch(tx.type) {
        case "INVOKE":
            if(
                tx.signed.calldata==null ||
                tx.details.walletAddress==null
            ) throw new Error("TX not enough data to compute hash!");

            const invokeData = CallData.compile(tx.signed.calldata);
            return tx.txId = hash.calculateInvokeTransactionHash({
                senderAddress: tx.details.walletAddress,
                compiledCalldata: invokeData,
                ...commonData
            });
        case "DEPLOY_ACCOUNT":
            if(
                tx.signed.constructorCalldata==null ||
                tx.signed.addressSalt==null ||
                tx.tx.contractAddress==null
            ) throw new Error("TX not enough data to compute hash!");

            const deployAccountData = CallData.compile(tx.signed.constructorCalldata);
            return tx.txId = hash.calculateDeployAccountTransactionHash({
                contractAddress: tx.tx.contractAddress,
                classHash: tx.signed.classHash,
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
    const valueBN = BigInt(value);
    return Number(((valueBN & 0xFFn) << 24n) |
        ((valueBN & 0xFF00n) << 8n) |
        ((valueBN >> 8n) & 0xFF00n) |
        ((valueBN >> 24n) & 0xFFn));
}

export function bigNumberishToBuffer(value: BigNumberish | Uint256, length?: number): Buffer {
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
    if(length!=null) value = value.padStart(length*2, "0");
    const buff = Buffer.from(value, "hex");
    if(length!=null && buff.length > length) return buff.slice(buff.length-length);
    return buff;
}

export function toBigInt(value: BigNumberish | Uint256): bigint;
export function toBigInt(value: null | undefined): null;
export function toBigInt(value: BigNumberish | Uint256 | null | undefined): bigint | null;
export function toBigInt(value: BigNumberish | Uint256 | null | undefined): bigint | null {
    if(value==null) return null;
    if(isUint256(value)) {
        return (toBigInt(value.high) << 128n) | toBigInt(value.low);
    }
    if(typeof(value)==="string") {
        if(!value.startsWith("0x")) value = "0x"+value;
        return BigInt(value);
    }
    if(typeof(value)==="bigint") {
        return value;
    }
    return BigInt(value);
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

export function bufferToBytes31Span(buffer: Buffer, startIndex: number = 0, endIndex: number = buffer.length): bigint[] {
    const values: bigint[] = [];
    for(let i=startIndex+31;i<endIndex;i+=31) {
        values.push(BigInt("0x"+buffer.slice(i-31, i).toString("hex")));
    }
    if(endIndex > startIndex + (values.length*31)) values.push(BigInt("0x"+buffer.slice(startIndex + (values.length*31), endIndex).toString("hex")));
    return values;
}

export function bufferToByteArray(buffer: Buffer, startIndex: number = 0, endIndex: number = buffer.length): BigNumberish[] {
    const values: BigNumberish[] = [];
    for(let i=startIndex+31;i<endIndex;i+=31) {
        values.push(BigInt("0x"+buffer.slice(i-31, i).toString("hex")));
    }
    let pendingWord: BigNumberish = BigInt(0);
    let pendingWordLen: BigNumberish = BigInt(endIndex - (startIndex + (values.length*31)));
    if(pendingWordLen !== BigInt(0)) {
        pendingWord = BigInt("0x"+buffer.slice(startIndex + (values.length*31), endIndex).toString("hex"));
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

export function findLastIndex<T>(array: T[], callback: (value: T, index: number) => boolean): number {
    for(let i=array.length-1;i>=0;i--){
        if(callback(array[i], i)) return i;
    }
    return -1;
}

export function bigIntMax(a: bigint, b: bigint) {
    return a>b ? a : b;
}

export function serializeSignature(signature?: Signature): string[] | undefined {
    return signature==null
        ? undefined
        : Array.isArray(signature)
            ? signature
            : [toHex(signature.r), toHex(signature.s)];
}

export function deserializeSignature(signature?: ReplaceBigInt<Signature>): Signature | undefined {
    return signature==null
        ? undefined
        : Array.isArray(signature)
            ? signature
            : [signature.r, signature.s]
}

export function serializeResourceBounds(resourceBounds: {
    l2_gas: {max_amount: BigNumberish, max_price_per_unit: BigNumberish},
    l1_gas: {max_amount: BigNumberish, max_price_per_unit: BigNumberish},
    l1_data_gas: {max_amount: BigNumberish, max_price_per_unit: BigNumberish}
}) {
    return {
        l2_gas: {
            max_amount: toHex(resourceBounds.l2_gas.max_amount),
            max_price_per_unit: toHex(resourceBounds.l2_gas.max_price_per_unit),
        },
        l1_gas: {
            max_amount: toHex(resourceBounds.l1_gas.max_amount),
            max_price_per_unit: toHex(resourceBounds.l1_gas.max_price_per_unit),
        },
        l1_data_gas: {
            max_amount: toHex(resourceBounds.l1_data_gas.max_amount),
            max_price_per_unit: toHex(resourceBounds.l1_data_gas.max_price_per_unit),
        }
    }
}

export function deserializeResourceBounds(resourceBounds: ResourceBounds): ResourceBoundsBN {
    return {
        l2_gas: {
            max_amount: BigInt(resourceBounds.l2_gas.max_amount),
            max_price_per_unit: BigInt(resourceBounds.l2_gas.max_price_per_unit),
        },
        l1_gas: {
            max_amount: BigInt(resourceBounds.l1_gas.max_amount),
            max_price_per_unit: BigInt(resourceBounds.l1_gas.max_price_per_unit),
        },
        l1_data_gas: {
            max_amount: BigInt(resourceBounds.l1_data_gas.max_amount),
            max_price_per_unit: BigInt(resourceBounds.l1_data_gas.max_price_per_unit),
        }
    };
}
