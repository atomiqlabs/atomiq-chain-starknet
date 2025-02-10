import * as BN from "bn.js";
import {toBigInt, toBN} from "../../../utils/Utils";
import { IntermediaryReputationType } from "@atomiqlabs/base";
import {StarknetSwapModule} from "../StarknetSwapModule";
import {StarknetAction} from "../../base/StarknetAction";
import {cairo} from "starknet";
import {StarknetTx} from "../../base/modules/StarknetTransactions";

export class StarknetLpVault extends StarknetSwapModule {

    private static readonly GasCosts = {
        WITHDRAW: {l1: 750, l2: 0},
        DEPOSIT: {l1: 750, l2: 0}
    };

    /**
     * Action for withdrawing funds from the LP vault
     *
     * @param signer
     * @param token
     * @param amount
     * @constructor
     * @private
     */
    private Withdraw(signer: string, token: string, amount: BN): StarknetAction {
        return new StarknetAction(signer, this.root,
            this.contract.populateTransaction.withdraw(token, cairo.uint256(toBigInt(amount)), signer),
            StarknetLpVault.GasCosts.WITHDRAW
        );
    }

    /**
     * Action for depositing funds to the LP vault
     *
     * @param signer
     * @param token
     * @param amount
     * @constructor
     * @private
     */
    private Deposit(signer: string, token: string, amount: BN): StarknetAction {
        return new StarknetAction(signer, this.root,
            this.contract.populateTransaction.deposit(token, cairo.uint256(toBigInt(amount))),
            StarknetLpVault.GasCosts.WITHDRAW
        );
    }

    /**
     * Returns intermediary's reputation & vault balance for a specific token
     *
     * @param address
     * @param token
     */
    public async getIntermediaryData(address: string, token: string): Promise<{
        balance: BN,
        reputation: IntermediaryReputationType
    }> {
        const [balance, reputation] = await Promise.all([
            this.getIntermediaryBalance(address, token),
            this.getIntermediaryReputation(address, token)
        ]);

        return {balance, reputation};
    }

    /**
     * Returns intermediary's reputation for a specific token
     *
     * @param address
     * @param token
     */
    public async getIntermediaryReputation(address: string, token: string): Promise<IntermediaryReputationType> {
        const filter = Object.keys(this.root.claimHandlersByAddress).map(address => cairo.tuple(address, token, address));
        const reputation = await this.contract.get_reputation(filter);
        const result: any = {};
        Object.keys(this.root.claimHandlersByAddress).forEach((address, index) => {
            const handler = this.root.claimHandlersByAddress[address];
            const reputationData: any[] = reputation[index] as unknown as any [];
            result[handler.getType()] = {
                successVolume: toBN(reputationData[0].amount),
                successCount: toBN(reputationData[0].count),
                failVolume: toBN(reputationData[2].amount),
                failCount: toBN(reputationData[2].count),
                coopCloseVolume: toBN(reputationData[1].amount),
                coopCloseCount: toBN(reputationData[1].count),
            };
        });
        return result as any;
    }

    /**
     * Returns the balance of the token an intermediary has in his LP vault
     *
     * @param address
     * @param token
     */
    public async getIntermediaryBalance(address: string, token: string): Promise<BN> {
        const balance = toBN((await this.contract.get_balance([cairo.tuple(address, token)]))[0]);

        this.logger.debug("getIntermediaryBalance(): token LP balance fetched, token: "+token.toString()+
            " address: "+address+" amount: "+(balance==null ? "null" : balance.toString()));

        return balance;
    }

    /**
     * Creates transactions for withdrawing funds from the LP vault, creates ATA if it doesn't exist and unwraps
     *  WSOL to SOL if required
     *
     * @param signer
     * @param token
     * @param amount
     * @param feeRate
     */
    public async txsWithdraw(signer: string, token: string, amount: BN, feeRate?: string): Promise<StarknetTx[]> {
        const action = await this.Withdraw(signer, token, amount);

        feeRate ??= await this.root.Fees.getFeeRate();

        this.logger.debug("txsWithdraw(): withdraw TX created, token: "+token.toString()+
            " amount: "+amount.toString(10));

        return [await action.tx(feeRate)];
    }

    /**
     * Creates transaction for depositing funds into the LP vault, wraps SOL to WSOL if required
     *
     * @param signer
     * @param token
     * @param amount
     * @param feeRate
     */
    public async txsDeposit(signer: string, token: string, amount: BN, feeRate?: string): Promise<StarknetTx[]> {
        //Approve first
        const action = await this.root.Tokens.Approve(signer, this.contract.address, token, amount);
        action.add(this.Deposit(signer, token, amount));

        feeRate ??= await this.root.Fees.getFeeRate();

        this.logger.debug("txsDeposit(): deposit TX created, token: "+token.toString()+
            " amount: "+amount.toString(10));

        return [await action.tx(feeRate)];
    }

}