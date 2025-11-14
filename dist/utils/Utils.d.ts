import { BigNumberish, Uint256 } from "starknet";
import { StarknetTx } from "../starknet/chain/modules/StarknetTransactions";
import { Buffer } from "buffer";
export type Serialized<T> = {
    [K in keyof T as T[K] extends Function ? never : K]: T[K] extends infer U ? U extends bigint ? string : U extends object ? Serialized<U> : U : never;
};
export declare function isUint256(val: any): val is Uint256;
export declare function timeoutPromise(timeoutMillis: number, abortSignal?: AbortSignal): Promise<void>;
export declare function onceAsync<T>(executor: () => Promise<T>): () => Promise<T>;
export type LoggerType = {
    debug: (msg: string, ...args: any[]) => void;
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
};
export declare function getLogger(prefix: string): LoggerType;
export declare function tryWithRetries<T>(func: () => Promise<T>, retryPolicy?: {
    maxRetries?: number;
    delay?: number;
    exponential?: boolean;
}, errorAllowed?: (e: any) => boolean, abortSignal?: AbortSignal): Promise<T>;
export declare function toHex(value: number | bigint | string | Buffer, length?: number): string;
export declare function toHex(value: undefined | null, length?: number): null;
export declare function toHex(value: number | bigint | string | Buffer | undefined | null, length?: number): string | null;
export declare function calculateHash(tx: StarknetTx): string;
export declare function u32ArrayToBuffer(arr: BigNumberish[]): Buffer;
export declare function bufferToU32Array(buffer: Buffer): number[];
export declare function u32ReverseEndianness(value: number): number;
export declare function bigNumberishToBuffer(value: BigNumberish | Uint256, length?: number): Buffer;
export declare function toBigInt(value: BigNumberish | Uint256): bigint;
export declare function toBigInt(value: null | undefined): null;
export declare function toBigInt(value: BigNumberish | Uint256 | null | undefined): bigint | null;
export declare function bytes31SpanToBuffer(span: BigNumberish[], length: number): Buffer;
export declare function bufferToBytes31Span(buffer: Buffer, startIndex?: number, endIndex?: number): bigint[];
export declare function bufferToByteArray(buffer: Buffer, startIndex?: number, endIndex?: number): BigNumberish[];
export declare function poseidonHashRange(buffer: Buffer, startIndex?: number, endIndex?: number): BigNumberish;
export declare function findLastIndex<T>(array: T[], callback: (value: T, index: number) => boolean): number;
export declare function bigIntMax(a: bigint, b: bigint): bigint;
