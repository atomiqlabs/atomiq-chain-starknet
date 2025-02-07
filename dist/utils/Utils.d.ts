/// <reference types="node" />
import * as BN from "bn.js";
import { BigNumberish, Uint256 } from "starknet";
import { StarknetTx } from "../starknet/base/modules/StarknetTransactions";
import { Buffer } from "buffer";
export declare function isUint256(val: any): val is Uint256;
export declare function timeoutPromise(timeoutMillis: number, abortSignal?: AbortSignal): Promise<void>;
export declare function onceAsync<T>(executor: () => Promise<T>): () => Promise<T>;
export declare function getLogger(prefix: string): {
    debug: (msg: any, ...args: any[]) => void;
    info: (msg: any, ...args: any[]) => void;
    warn: (msg: any, ...args: any[]) => void;
    error: (msg: any, ...args: any[]) => void;
};
export declare function tryWithRetries<T>(func: () => Promise<T>, retryPolicy?: {
    maxRetries?: number;
    delay?: number;
    exponential?: boolean;
}, errorAllowed?: (e: any) => boolean, abortSignal?: AbortSignal): Promise<T>;
export declare function toBigInt(value: BN): bigint;
export declare function toHex(value: BN | number | bigint | string): string;
export declare function calculateHash(tx: StarknetTx): string;
export declare function u32ArrayToBuffer(arr: BigNumberish[]): Buffer;
export declare function bufferToU32Array(buffer: Buffer): number[];
export declare function u32ReverseEndianness(value: number): number;
export declare function bigNumberishToBuffer(value: BigNumberish | Uint256, length: number): Buffer;
export declare function toBN(value: BigNumberish | Uint256): BN;
export declare function bufferToBytes31Span(buffer: Buffer, startIndex?: number, endIndex?: number): BigNumberish[];
export declare function bufferToByteArray(buffer: Buffer, startIndex?: number, endIndex?: number): BigNumberish[];
export declare function poseidonHashRange(buffer: Buffer, startIndex?: number, endIndex?: number): BigNumberish;
