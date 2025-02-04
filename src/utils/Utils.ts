import * as BN from "bn.js";
import {EDAMode} from "starknet-types-07";
import {CallData, hash} from "starknet";
import {StarknetTx} from "../starknet/base/modules/StarknetTransactions";

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
