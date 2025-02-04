import * as BN from "bn.js";
import {StarknetModule} from "../StarknetModule";
import {StarknetAction} from "../StarknetAction";
import {ERC20Abi} from "./ERC20Abi";
import {CallData, Contract, events} from "starknet";
import { toBigInt } from "../../../utils/Utils";
import {EventToPrimitiveType, ExtractAbiEventNames, ExtractAbiEvents} from "abi-wan-kanabi/dist/kanabi";
import {Abi} from "abi-wan-kanabi";

const NATIVE_ADDRESS_ETH = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

export type StarknetEventType<TAbi extends Abi, TEventName extends ExtractAbiEventNames<TAbi>> = {
    name: TEventName,
    params: EventToPrimitiveType<TAbi, TEventName>,
    txHash: string,
    blockHash: string,
    blockNumber: number
};

export class StarknetTokens extends StarknetModule {

    public static readonly GasCosts = {
        TRANSFER: 5000,
        APPROVE: 5000
    };

    private getContract(address: string) {
        return new Contract(ERC20Abi, address, this.root.provider).typedv2(ERC20Abi);
    }

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
    private Transfer(signer: string, recipient: string, token: string, amount: BN): StarknetAction {
        const erc20 = this.getContract(token);
        const abiEvents = events.getAbiEvents(ERC20Abi);
        const abiStructs = CallData.getAbiStruct(ERC20Abi);
        const abiEnums = CallData.getAbiEnum(ERC20Abi);
        const result = events.parseEvents([], abiEvents, abiStructs, abiEnums);

        let type: StarknetEventType<typeof ERC20Abi, "openzeppelin::token::erc20_v070::erc20::ERC20::Transfer">;

        return new StarknetAction(signer, this.root,
            erc20.populateTransaction.transfer(recipient, toBigInt(amount)),
            {l1: StarknetTokens.GasCosts.TRANSFER}
        );
    }

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
    public Approve(signer: string, spender: string, token: string, amount: BN): StarknetAction {
        const erc20 = this.getContract(token);
        return new StarknetAction(signer, this.root,
            erc20.populateTransaction.approve(spender, toBigInt(amount)),
            {l1: StarknetTokens.GasCosts.APPROVE}
        );
    }

    ///////////////////
    //// Tokens
    /**
     * Checks if the provided string is a valid starknet token
     *
     * @param token
     */
    public isValidToken(token: string) {
        return this.root.Addresses.isValidAddress(token);
    }

    /**
     * Returns the token balance of the address
     *
     * @param address
     * @param token
     */
    public async getTokenBalance(address: string, token: string): Promise<BN> {
        const erc20 = this.getContract(token);
        const balance = await erc20.balance_of(address);
        const balanceBN = new BN(balance.toString(10));

        this.logger.debug("getTokenBalance(): token balance fetched, token: "+token+
            " address: "+address+" amount: "+balanceBN.toString());

        return balanceBN;
    }

    /**
     * Returns the native currency address, we use WSOL address as placeholder for SOL
     */
    public getNativeCurrencyAddress(): string {
        return NATIVE_ADDRESS_ETH;
    }

    ///////////////////
    //// Transfers
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
    public async txsTransfer(signer: string, token: string, amount: BN, recipient: string, feeRate?: string) {
        feeRate = feeRate || await this.root.Fees.getFeeRate();

        const action = this.Transfer(signer, recipient, token, amount);

        this.logger.debug("txsTransfer(): transfer TX created, recipient: "+recipient.toString()+
            " token: "+token.toString()+ " amount: "+amount.toString(10));

        return [await action.tx(feeRate)];
    }

}