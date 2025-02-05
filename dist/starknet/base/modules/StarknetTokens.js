"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetTokens = void 0;
const BN = require("bn.js");
const StarknetModule_1 = require("../StarknetModule");
const StarknetAction_1 = require("../StarknetAction");
const ERC20Abi_1 = require("./ERC20Abi");
const starknet_1 = require("starknet");
const Utils_1 = require("../../../utils/Utils");
const NATIVE_ADDRESS_ETH = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
class StarknetTokens extends StarknetModule_1.StarknetModule {
    getContract(address) {
        return new starknet_1.Contract(ERC20Abi_1.ERC20Abi, address, this.root.provider).typedv2(ERC20Abi_1.ERC20Abi);
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
    Transfer(signer, recipient, token, amount) {
        const erc20 = this.getContract(token);
        return new StarknetAction_1.StarknetAction(signer, this.root, erc20.populateTransaction.transfer(recipient, (0, Utils_1.toBigInt)(amount)), { l1: StarknetTokens.GasCosts.TRANSFER });
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
    Approve(signer, spender, token, amount) {
        const erc20 = this.getContract(token);
        return new StarknetAction_1.StarknetAction(signer, this.root, erc20.populateTransaction.approve(spender, (0, Utils_1.toBigInt)(amount)), { l1: StarknetTokens.GasCosts.APPROVE });
    }
    ///////////////////
    //// Tokens
    /**
     * Checks if the provided string is a valid starknet token
     *
     * @param token
     */
    isValidToken(token) {
        return this.root.Addresses.isValidAddress(token);
    }
    /**
     * Returns the token balance of the address
     *
     * @param address
     * @param token
     */
    getTokenBalance(address, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const erc20 = this.getContract(token);
            const balance = yield erc20.balance_of(address);
            const balanceBN = new BN(balance.toString(10));
            this.logger.debug("getTokenBalance(): token balance fetched, token: " + token +
                " address: " + address + " amount: " + balanceBN.toString());
            return balanceBN;
        });
    }
    /**
     * Returns the native currency address, we use WSOL address as placeholder for SOL
     */
    getNativeCurrencyAddress() {
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
    txsTransfer(signer, token, amount, recipient, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            feeRate = feeRate || (yield this.root.Fees.getFeeRate());
            const action = this.Transfer(signer, recipient, token, amount);
            this.logger.debug("txsTransfer(): transfer TX created, recipient: " + recipient.toString() +
                " token: " + token.toString() + " amount: " + amount.toString(10));
            return [yield action.tx(feeRate)];
        });
    }
}
exports.StarknetTokens = StarknetTokens;
StarknetTokens.GasCosts = {
    TRANSFER: 5000,
    APPROVE: 5000
};
