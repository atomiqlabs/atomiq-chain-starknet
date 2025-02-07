import {Provider, constants} from "starknet";
import {getLogger} from "../../utils/Utils";
import {StarknetTransactions} from "./modules/StarknetTransactions";
import {StarknetFees} from "./modules/StarknetFees";
import {StarknetAddresses} from "./modules/StarknetAddresses";
import {StarknetTokens} from "./modules/StarknetTokens";
import {StarknetEvents} from "./modules/StarknetEvents";
import {StarknetSignatures} from "./modules/StarknetSignatures";
import {StarknetAccounts} from "./modules/StarknetAccounts";

export type StarknetRetryPolicy = {
    maxRetries?: number,
    delay?: number,
    exponential?: boolean
}

export class StarknetBase {

    readonly provider: Provider;
    readonly retryPolicy: StarknetRetryPolicy;

    public readonly starknetChainId: constants.StarknetChainId;

    public Fees: StarknetFees;
    public readonly Tokens: StarknetTokens;
    public readonly Transactions: StarknetTransactions;
    public readonly Addresses: StarknetAddresses;
    public readonly Signatures: StarknetSignatures;
    public readonly Events: StarknetEvents;
    public readonly Accounts: StarknetAccounts;

    protected readonly logger = getLogger(this.constructor.name+": ");

    constructor(
        chainId: constants.StarknetChainId,
        provider: Provider,
        retryPolicy?: StarknetRetryPolicy,
        solanaFeeEstimator: StarknetFees = new StarknetFees(provider)
    ) {
        this.starknetChainId = chainId;
        this.provider = provider;
        this.retryPolicy = retryPolicy;

        this.Fees = solanaFeeEstimator;
        this.Tokens = new StarknetTokens(this);
        this.Transactions = new StarknetTransactions(this);
        this.Addresses = new StarknetAddresses(this);
        this.Signatures = new StarknetSignatures(this);
        this.Events = new StarknetEvents(this);
        this.Accounts = new StarknetAccounts(this);
    }

}
