import { Provider, constants } from "starknet";
import { StarknetTransactions } from "./modules/StarknetTransactions";
import { StarknetFees } from "./modules/StarknetFees";
import { StarknetAddresses } from "./modules/StarknetAddresses";
import { StarknetTokens } from "./modules/StarknetTokens";
import { StarknetEvents } from "./modules/StarknetEvents";
import { StarknetSignatures } from "./modules/StarknetSignatures";
import { StarknetAccounts } from "./modules/StarknetAccounts";
export type StarknetRetryPolicy = {
    maxRetries?: number;
    delay?: number;
    exponential?: boolean;
};
export declare class StarknetBase {
    readonly provider: Provider;
    readonly retryPolicy: StarknetRetryPolicy;
    readonly starknetChainId: constants.StarknetChainId;
    Fees: StarknetFees;
    readonly Tokens: StarknetTokens;
    readonly Transactions: StarknetTransactions;
    readonly Addresses: StarknetAddresses;
    readonly Signatures: StarknetSignatures;
    readonly Events: StarknetEvents;
    readonly Accounts: StarknetAccounts;
    protected readonly logger: {
        debug: (msg: any, ...args: any[]) => void;
        info: (msg: any, ...args: any[]) => void;
        warn: (msg: any, ...args: any[]) => void;
        error: (msg: any, ...args: any[]) => void;
    };
    constructor(chainId: constants.StarknetChainId, provider: Provider, retryPolicy?: StarknetRetryPolicy, solanaFeeEstimator?: StarknetFees);
}
