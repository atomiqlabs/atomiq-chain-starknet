import { BigNumberish, Uint256 } from "starknet";
import { StarknetTx } from "../starknet/chain/modules/StarknetTransactions";
import { Buffer } from "buffer";
import { StarknetSwapData } from "../starknet/swaps/StarknetSwapData";
import { IClaimHandler } from "../starknet/swaps/handlers/claim/ClaimHandlers";
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
export declare function toHex(value: number | bigint | string | Buffer, length?: number): string;
export declare function calculateHash(tx: StarknetTx): string;
export declare function u32ArrayToBuffer(arr: BigNumberish[]): Buffer;
export declare function bufferToU32Array(buffer: Buffer): number[];
export declare function u32ReverseEndianness(value: number): number;
export declare function bigNumberishToBuffer(value: BigNumberish | Uint256, length?: number): Buffer;
export declare function toBigInt(value: BigNumberish | Uint256): bigint;
export declare function bytes31SpanToBuffer(span: BigNumberish[], length: number): Buffer;
export declare function bufferToBytes31Span(buffer: Buffer, startIndex?: number, endIndex?: number): BigNumberish[];
export declare function bufferToByteArray(buffer: Buffer, startIndex?: number, endIndex?: number): BigNumberish[];
export declare function poseidonHashRange(buffer: Buffer, startIndex?: number, endIndex?: number): BigNumberish;
export declare function parseInitFunctionCalldata(calldata: BigNumberish[], claimHandler: IClaimHandler<any, any>): {
    escrow: StarknetSwapData;
    signature: BigNumberish[];
    timeout: bigint;
    extraData: BigNumberish[];
};
export declare function findLastIndex<T>(array: T[], callback: (value: T, index: number) => boolean): number;
