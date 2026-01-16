"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetSwapData = exports.isSerializedData = void 0;
const base_1 = require("@atomiqlabs/base");
const TimelockRefundHandler_1 = require("./handlers/refund/TimelockRefundHandler");
const starknet_1 = require("starknet");
const Utils_1 = require("../../utils/Utils");
const FLAG_PAY_OUT = 0x01n;
const FLAG_PAY_IN = 0x02n;
const FLAG_REPUTATION = 0x04n;
function successActionEquals(a, b) {
    if (a != null && b != null) {
        return a.executionHash.toLowerCase() === b.executionHash.toLowerCase() &&
            a.executionExpiry === b.executionExpiry &&
            a.executionFee === b.executionFee;
    }
    return a === b;
}
function isSerializedData(obj) {
    return obj.type === "strk";
}
exports.isSerializedData = isSerializedData;
/**
 * @category Swaps
 */
class StarknetSwapData extends base_1.SwapData {
    static toFlags(value) {
        const val = (0, Utils_1.toBigInt)(value);
        return {
            sequence: val >> 64n,
            payOut: (val & FLAG_PAY_OUT) === FLAG_PAY_OUT,
            payIn: (val & FLAG_PAY_IN) === FLAG_PAY_IN,
            reputation: (val & FLAG_REPUTATION) === FLAG_REPUTATION
        };
    }
    getFlags() {
        return (this.sequence << 64n) +
            (this.payOut ? FLAG_PAY_OUT : 0n) +
            (this.payIn ? FLAG_PAY_IN : 0n) +
            (this.reputation ? FLAG_REPUTATION : 0n);
    }
    constructor(data) {
        super();
        if (!isSerializedData(data)) {
            this.offerer = data.offerer;
            this.claimer = data.claimer;
            this.token = data.token;
            this.refundHandler = data.refundHandler;
            this.claimHandler = data.claimHandler;
            this.payOut = data.payOut;
            this.payIn = data.payIn;
            this.reputation = data.reputation;
            this.sequence = data.sequence;
            this.claimData = data.claimData;
            this.refundData = data.refundData;
            this.amount = data.amount;
            this.feeToken = data.feeToken;
            this.securityDeposit = data.securityDeposit;
            this.claimerBounty = data.claimerBounty;
            this.kind = data.kind;
            this.extraData = data.extraData;
            this.successAction = data.successAction;
        }
        else {
            this.offerer = data.offerer;
            this.claimer = data.claimer;
            this.token = data.token;
            this.refundHandler = data.refundHandler;
            this.claimHandler = data.claimHandler;
            this.payOut = data.payOut;
            this.payIn = data.payIn;
            this.reputation = data.reputation;
            this.sequence = BigInt(data.sequence);
            this.claimData = data.claimData;
            this.refundData = data.refundData;
            this.amount = BigInt(data.amount);
            this.feeToken = data.feeToken;
            this.securityDeposit = BigInt(data.securityDeposit);
            this.claimerBounty = BigInt(data.claimerBounty);
            this.kind = data.kind;
            this.extraData = data.extraData;
            this.successAction = data.successAction == null || Array.isArray(data.successAction) ? undefined : {
                executionHash: data.successAction.executionHash,
                executionExpiry: BigInt(data.successAction.executionExpiry),
                executionFee: BigInt(data.successAction.executionFee),
            };
        }
    }
    getOfferer() {
        return this.offerer;
    }
    setOfferer(newOfferer) {
        this.offerer = newOfferer;
        this.payIn = true;
    }
    getClaimer() {
        return this.claimer;
    }
    setClaimer(newClaimer) {
        this.claimer = newClaimer;
        this.payIn = false;
        this.payOut = true;
        this.reputation = false;
    }
    serialize() {
        return {
            type: "strk",
            offerer: this.offerer,
            claimer: this.claimer,
            token: this.token,
            refundHandler: this.refundHandler,
            claimHandler: this.claimHandler,
            payOut: this.payOut,
            payIn: this.payIn,
            reputation: this.reputation,
            sequence: this.sequence?.toString(10),
            claimData: this.claimData,
            refundData: this.refundData,
            amount: this.amount?.toString(10),
            feeToken: this.feeToken,
            securityDeposit: this.securityDeposit?.toString(10),
            claimerBounty: this.claimerBounty?.toString(10),
            kind: this.kind,
            extraData: this.extraData,
            successAction: this.successAction == null ? undefined : {
                executionHash: this.successAction.executionHash,
                executionExpiry: this.successAction.executionExpiry.toString(10),
                executionFee: this.successAction.executionFee.toString(10)
            }
        };
    }
    getAmount() {
        return this.amount;
    }
    getToken() {
        return this.token;
    }
    isToken(token) {
        return this.token.toLowerCase() === token.toLowerCase();
    }
    getType() {
        return this.kind;
    }
    getExpiry() {
        return TimelockRefundHandler_1.TimelockRefundHandler.getExpiry(this);
    }
    isPayIn() {
        return this.payIn;
    }
    isPayOut() {
        return this.payOut;
    }
    getEscrowHash() {
        const amountValue = starknet_1.cairo.uint256("0x" + this.amount.toString(16));
        const securityDepositValue = starknet_1.cairo.uint256("0x" + this.securityDeposit.toString(16));
        const claimerBountyValue = starknet_1.cairo.uint256("0x" + this.claimerBounty.toString(16));
        const elements = [
            this.offerer,
            this.claimer,
            this.token,
            this.refundHandler,
            this.claimHandler,
            this.getFlags(),
            this.claimData,
            this.refundData,
            amountValue.low,
            amountValue.high,
            this.feeToken,
            securityDepositValue.low,
            securityDepositValue.high,
            claimerBountyValue.low,
            claimerBountyValue.high
        ];
        if (this.successAction != null) {
            elements.push(this.successAction.executionHash);
            elements.push(this.successAction.executionExpiry);
            const feeValue = starknet_1.cairo.uint256("0x" + this.successAction.executionFee.toString(16));
            elements.push(feeValue.low, feeValue.high);
        }
        let escrowHash = starknet_1.hash.computePoseidonHashOnElements(elements);
        if (escrowHash.startsWith("0x"))
            escrowHash = escrowHash.slice(2);
        return escrowHash.padStart(64, "0");
    }
    getClaimHash() {
        let hash = this.claimData;
        if (hash.startsWith("0x"))
            hash = hash.slice(2);
        return hash.padStart(64, "0");
    }
    getSequence() {
        return this.sequence;
    }
    getConfirmationsHint() {
        if (this.extraData == null)
            return null;
        if (this.extraData.length != 84)
            return null;
        return parseInt(this.extraData.slice(80), 16);
    }
    getNonceHint() {
        if (this.extraData == null)
            return null;
        if (this.extraData.length != 84)
            return null;
        return BigInt("0x" + this.extraData.slice(64, 80));
    }
    getTxoHashHint() {
        if (this.extraData == null)
            return null;
        if (this.extraData.length != 84)
            return null;
        return this.extraData.slice(0, 64);
    }
    getExtraData() {
        return this.extraData ?? null;
    }
    setExtraData(extraData) {
        this.extraData = extraData;
    }
    getSecurityDeposit() {
        return this.securityDeposit;
    }
    getClaimerBounty() {
        return this.claimerBounty;
    }
    getTotalDeposit() {
        return this.claimerBounty < this.securityDeposit ? this.securityDeposit : this.claimerBounty;
    }
    getDepositToken() {
        return this.feeToken;
    }
    isDepositToken(token) {
        if (!token.startsWith("0x"))
            token = "0x" + token;
        return (0, Utils_1.toHex)(this.feeToken) === (0, Utils_1.toHex)(token);
    }
    isClaimer(address) {
        if (!address.startsWith("0x"))
            address = "0x" + address;
        return (0, Utils_1.toHex)(this.claimer) === (0, Utils_1.toHex)(address);
    }
    isOfferer(address) {
        if (!address.startsWith("0x"))
            address = "0x" + address;
        return (0, Utils_1.toHex)(this.offerer) === (0, Utils_1.toHex)(address);
    }
    isRefundHandler(address) {
        if (!address.startsWith("0x"))
            address = "0x" + address;
        return (0, Utils_1.toHex)(this.refundHandler) === (0, Utils_1.toHex)(address);
    }
    isClaimHandler(address) {
        if (!address.startsWith("0x"))
            address = "0x" + address;
        return (0, Utils_1.toHex)(this.claimHandler) === (0, Utils_1.toHex)(address);
    }
    isClaimData(data) {
        if (!data.startsWith("0x"))
            data = "0x" + data;
        return (0, Utils_1.toHex)(this.claimData) === (0, Utils_1.toHex)(data);
    }
    equals(other) {
        return other.offerer.toLowerCase() === this.offerer.toLowerCase() &&
            other.claimer.toLowerCase() === this.claimer.toLowerCase() &&
            other.token.toLowerCase() === this.token.toLowerCase() &&
            other.refundHandler.toLowerCase() === this.refundHandler.toLowerCase() &&
            other.claimHandler.toLowerCase() === this.claimHandler.toLowerCase() &&
            other.payIn === this.payIn &&
            other.payOut === this.payOut &&
            other.reputation === this.reputation &&
            this.sequence === other.sequence &&
            other.claimData.toLowerCase() === this.claimData.toLowerCase() &&
            other.refundData.toLowerCase() === this.refundData.toLowerCase() &&
            other.amount === this.amount &&
            other.securityDeposit === this.securityDeposit &&
            other.claimerBounty === this.claimerBounty &&
            successActionEquals(other.successAction, this.successAction);
    }
    toEscrowStruct() {
        return {
            offerer: this.offerer,
            claimer: this.claimer,
            token: this.token,
            refund_handler: this.refundHandler,
            claim_handler: this.claimHandler,
            flags: this.getFlags(),
            claim_data: this.claimData,
            refund_data: this.refundData,
            amount: starknet_1.cairo.uint256((0, Utils_1.toBigInt)(this.amount)),
            fee_token: this.feeToken,
            security_deposit: starknet_1.cairo.uint256((0, Utils_1.toBigInt)(this.securityDeposit)),
            claimer_bounty: starknet_1.cairo.uint256((0, Utils_1.toBigInt)(this.claimerBounty)),
            success_action: new starknet_1.CairoOption(this.successAction == null ? starknet_1.CairoOptionVariant.None : starknet_1.CairoOptionVariant.Some, this.successAction == null ? undefined : {
                hash: this.successAction.executionHash,
                expiry: this.successAction.executionExpiry,
                fee: starknet_1.cairo.uint256(this.successAction.executionFee)
            })
        };
    }
    static fromSerializedFeltArray(span, claimHandlerImpl) {
        if (span.length < 16)
            throw new Error("Invalid length of serialized starknet swap data!");
        const offerer = (0, Utils_1.toHex)(span.shift());
        const claimer = (0, Utils_1.toHex)(span.shift());
        const token = (0, Utils_1.toHex)(span.shift());
        const refundHandler = (0, Utils_1.toHex)(span.shift());
        const claimHandler = (0, Utils_1.toHex)(span.shift());
        const { payOut, payIn, reputation, sequence } = StarknetSwapData.toFlags(span.shift());
        const claimData = (0, Utils_1.toHex)(span.shift());
        const refundData = (0, Utils_1.toHex)(span.shift());
        const amount = (0, Utils_1.toBigInt)({ low: span.shift(), high: span.shift() });
        const feeToken = (0, Utils_1.toHex)(span.shift());
        const securityDeposit = (0, Utils_1.toBigInt)({ low: span.shift(), high: span.shift() });
        const claimerBounty = (0, Utils_1.toBigInt)({ low: span.shift(), high: span.shift() });
        const hasSuccessAction = (0, Utils_1.toBigInt)(span.shift()) === 0n;
        let successAction = undefined;
        if (hasSuccessAction) {
            if (span.length < 4)
                throw new Error("Invalid length of serialized starknet swap data!");
            successAction = {
                executionHash: (0, Utils_1.toHex)(span.shift()),
                executionExpiry: (0, Utils_1.toBigInt)(span.shift()),
                executionFee: (0, Utils_1.toBigInt)({ low: span.shift(), high: span.shift() })
            };
        }
        return new StarknetSwapData({
            offerer,
            claimer,
            token,
            refundHandler,
            claimHandler,
            payOut,
            payIn,
            reputation,
            sequence,
            claimData,
            refundData,
            amount,
            feeToken,
            securityDeposit,
            claimerBounty,
            kind: claimHandlerImpl.getType(),
            successAction
        });
    }
    hasSuccessAction() {
        return this.successAction != null;
    }
}
exports.StarknetSwapData = StarknetSwapData;
base_1.SwapData.deserializers["strk"] = StarknetSwapData;
