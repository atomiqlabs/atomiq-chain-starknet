"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetSwapData = void 0;
const BN = require("bn.js");
const base_1 = require("@atomiqlabs/base");
const TimelockRefundHandler_1 = require("./handlers/refund/TimelockRefundHandler");
const starknet_1 = require("starknet");
const Utils_1 = require("../../utils/Utils");
const ClaimHandlers_1 = require("./handlers/claim/ClaimHandlers");
const FLAG_PAY_OUT = 0x01;
const FLAG_PAY_IN = 0x02;
const FLAG_REPUTATION = 0x04;
class StarknetSwapData extends base_1.SwapData {
    static toFlags(value) {
        const val = (0, Utils_1.toBN)(value);
        return {
            sequence: val.shrn(64),
            payOut: val.and(new BN(FLAG_PAY_OUT)).eq(new BN(FLAG_PAY_OUT)),
            payIn: val.and(new BN(FLAG_PAY_IN)).eq(new BN(FLAG_PAY_IN)),
            reputation: val.and(new BN(FLAG_REPUTATION)).eq(new BN(FLAG_REPUTATION)),
        };
    }
    getFlags() {
        return (0, Utils_1.toBigInt)(new BN(this.sequence).shln(64).addn((this.payOut ? FLAG_PAY_OUT : 0) +
            (this.payIn ? FLAG_PAY_IN : 0) +
            (this.reputation ? FLAG_REPUTATION : 0)));
    }
    constructor(offererOrData, claimer, token, refundHandler, claimHandler, payOut, payIn, reputation, sequence, claimData, refundData, amount, feeToken, securityDeposit, claimerBounty, extraData) {
        super();
        if (claimer != null || token != null || refundHandler != null || claimHandler != null ||
            payOut != null || payIn != null || reputation != null || sequence != null || claimData != null || refundData != null ||
            amount != null || feeToken != null || securityDeposit != null || claimerBounty != null || extraData != null) {
            this.offerer = offererOrData;
            this.claimer = claimer;
            this.token = token;
            this.refundHandler = refundHandler;
            this.claimHandler = claimHandler;
            this.payOut = payOut;
            this.payIn = payIn;
            this.reputation = reputation;
            this.sequence = sequence;
            this.claimData = claimData;
            this.refundData = refundData;
            this.amount = amount;
            this.feeToken = feeToken;
            this.securityDeposit = securityDeposit;
            this.claimerBounty = claimerBounty;
            this.extraData = extraData;
        }
        else {
            this.offerer = offererOrData.offerer;
            this.claimer = offererOrData.claimer;
            this.token = offererOrData.token;
            this.refundHandler = offererOrData.refundHandler;
            this.claimHandler = offererOrData.claimHandler;
            this.payOut = offererOrData.payOut;
            this.payIn = offererOrData.payIn;
            this.reputation = offererOrData.reputation;
            this.sequence = offererOrData.sequence == null ? null : new BN(offererOrData.sequence);
            this.claimData = offererOrData.claimData;
            this.refundData = offererOrData.refundData;
            this.amount = offererOrData.amount == null ? null : new BN(offererOrData.amount);
            this.feeToken = offererOrData.feeToken;
            this.securityDeposit = offererOrData.securityDeposit == null ? null : new BN(offererOrData.securityDeposit);
            this.claimerBounty = offererOrData.claimerBounty == null ? null : new BN(offererOrData.claimerBounty);
            this.extraData = offererOrData.extraData;
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
        this.reputation = true;
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
            claimData: this.claimData,
            refundData: this.refundData,
            amount: this.amount == null ? null : this.amount.toString(10),
            feeToken: this.feeToken,
            securityDeposit: this.securityDeposit == null ? null : this.securityDeposit.toString(10),
            claimerBounty: this.claimerBounty == null ? null : this.claimerBounty.toString(10),
            extraData: this.extraData
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
        var _a;
        return (_a = ClaimHandlers_1.claimHandlersByAddress === null || ClaimHandlers_1.claimHandlersByAddress === void 0 ? void 0 : ClaimHandlers_1.claimHandlersByAddress[this.claimHandler.toLowerCase()]) === null || _a === void 0 ? void 0 : _a.type;
    }
    getExpiry() {
        if (!this.isRefundHandler(TimelockRefundHandler_1.TimelockRefundHandler.address))
            return null;
        return new BN(TimelockRefundHandler_1.TimelockRefundHandler.getExpiry(this).toString(10));
    }
    getConfirmations() { return null; }
    getEscrowNonce() { return null; }
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
        let escrowHash = starknet_1.hash.computePoseidonHashOnElements([
            this.offerer,
            this.claimer,
            this.token,
            this.refundHandler,
            this.claimHandler,
            this.getFlags(),
            (0, Utils_1.toHex)(this.claimData),
            (0, Utils_1.toHex)(this.refundData),
            amountValue.low,
            amountValue.high,
            this.feeToken,
            securityDepositValue.low,
            securityDepositValue.high,
            claimerBountyValue.low,
            claimerBountyValue.high
        ]);
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
        return new BN(this.extraData.slice(64, 80), "hex");
    }
    getTxoHashHint() {
        if (this.extraData == null)
            return null;
        if (this.extraData.length != 84)
            return null;
        return this.extraData.slice(0, 64);
    }
    getExtraData() {
        return this.extraData;
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
        return this.claimerBounty.lt(this.securityDeposit) ? this.securityDeposit : this.claimerBounty;
    }
    isClaimer(address) {
        return this.claimer.toLowerCase() === address.toLowerCase();
    }
    isOfferer(address) {
        return this.offerer.toLowerCase() === address.toLowerCase();
    }
    isRefundHandler(address) {
        return this.refundHandler.toLowerCase() === address.toLowerCase();
    }
    isClaimHandler(address) {
        return this.claimHandler.toLowerCase() === address.toLowerCase();
    }
    isClaimData(data) {
        return this.claimData.toLowerCase() === data.toLowerCase();
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
            this.sequence.eq(other.sequence) &&
            other.claimData.toLowerCase() === this.claimData.toLowerCase() &&
            other.refundData.toLowerCase() === this.refundData.toLowerCase() &&
            other.amount.eq(this.amount) &&
            other.securityDeposit.eq(this.securityDeposit) &&
            other.claimerBounty.eq(this.claimerBounty);
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
            claimer_bounty: starknet_1.cairo.uint256((0, Utils_1.toBigInt)(this.claimerBounty))
        };
    }
    static fromEscrowStruct(data) {
        const { payOut, payIn, reputation, sequence } = StarknetSwapData.toFlags(data.flags);
        return new StarknetSwapData(data.offerer, data.claimer, data.token, data.refund_handler, data.claim_handler, payOut, payIn, reputation, sequence, (0, Utils_1.toHex)(data.claim_data), (0, Utils_1.toHex)(data.refund_data), (0, Utils_1.toBN)(data.amount), data.fee_token, (0, Utils_1.toBN)(data.security_deposit), (0, Utils_1.toBN)(data.claimer_bounty), null);
    }
    static fromSerializedFeltArray(span) {
        const offerer = (0, Utils_1.toHex)(span.shift());
        const claimer = (0, Utils_1.toHex)(span.shift());
        const token = (0, Utils_1.toHex)(span.shift());
        const refundHandler = (0, Utils_1.toHex)(span.shift());
        const claimHandler = (0, Utils_1.toHex)(span.shift());
        const { payOut, payIn, reputation, sequence } = StarknetSwapData.toFlags(span.pop());
        const claimData = (0, Utils_1.toHex)(span.pop());
        const refundData = (0, Utils_1.toHex)(span.pop());
        const amount = (0, Utils_1.toBN)({ low: span.pop(), high: span.pop() });
        const feeToken = (0, Utils_1.toHex)(span.pop());
        const securityDeposit = (0, Utils_1.toBN)({ low: span.pop(), high: span.pop() });
        const claimerBounty = (0, Utils_1.toBN)({ low: span.pop(), high: span.pop() });
        return new StarknetSwapData(offerer, claimer, token, refundHandler, claimHandler, payOut, payIn, reputation, sequence, claimData, refundData, amount, feeToken, securityDeposit, claimerBounty, null);
    }
}
exports.StarknetSwapData = StarknetSwapData;
base_1.SwapData.deserializers["strk"] = StarknetSwapData;
