import * as BN from "bn.js";
import { StarknetModule } from "../StarknetModule";
import { StarknetAction } from "../StarknetAction";
export declare class StarknetTokens extends StarknetModule {
    static readonly GasCosts: {
        TRANSFER: {
            l1: number;
            l2: number;
        };
        APPROVE: {
            l1: number;
            l2: number;
        };
    };
    private getContract;
    /**
     * Action for transferring the erc20 token
     *
     * @param signer
     * @param recipient
     * @param token
     * @param amount
     * @constructor
     * @private
     */
    private Transfer;
    /**
     * Approves spend of tokens for a specific spender
     *
     * @param signer
     * @param spender
     * @param token
     * @param amount
     * @constructor
     * @private
     */
    Approve(signer: string, spender: string, token: string, amount: BN): StarknetAction;
    /**
     * Checks if the provided string is a valid starknet token
     *
     * @param token
     */
    isValidToken(token: string): boolean;
    /**
     * Returns the token balance of the address
     *
     * @param address
     * @param token
     */
    getTokenBalance(address: string, token: string): Promise<BN>;
    /**
     * Returns the native currency address, we use ETH
     */
    getNativeCurrencyAddress(): string;
    /**
     * Creates transactions for sending the over the tokens
     *
     * @param signer
     * @param token token to send
     * @param amount amount of the token to send
     * @param recipient recipient's address
     * @param feeRate fee rate to use for the transactions
     * @private
     */
    txsTransfer(signer: string, token: string, amount: BN, recipient: string, feeRate?: string): Promise<import("./StarknetTransactions").StarknetTx[]>;
}
