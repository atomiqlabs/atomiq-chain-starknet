import * as BN from "bn.js";
import {SwapData, ChainSwapType} from "@atomiqlabs/base";
import {TimelockRefundHandler} from "./handlers/refund/TimelockRefundHandler";
import {BigNumberish, cairo, hash} from "starknet";
import {toBigInt, toBN, toHex} from "../../utils/Utils";
import {
    StringToPrimitiveType
} from "abi-wan-kanabi/dist/kanabi";
import {EscrowManagerAbi} from "./EscrowManagerAbi";
import {IClaimHandler} from "./handlers/claim/ClaimHandlers";

const FLAG_PAY_OUT: number = 0x01;
const FLAG_PAY_IN: number = 0x02;
const FLAG_REPUTATION: number = 0x04;

export type StarknetSwapDataType = StringToPrimitiveType<typeof EscrowManagerAbi, "escrow_manager::structs::escrow::EscrowData">;

export class StarknetSwapData extends SwapData {

    static toFlags(value: number | bigint | string): {payOut: boolean, payIn: boolean, reputation: boolean, sequence: BN} {
        const val = toBN(value);
        return {
            sequence: val.shrn(64),
            payOut: val.and(new BN(FLAG_PAY_OUT)).eq(new BN(FLAG_PAY_OUT)),
            payIn: val.and(new BN(FLAG_PAY_IN)).eq(new BN(FLAG_PAY_IN)),
            reputation: val.and(new BN(FLAG_REPUTATION)).eq(new BN(FLAG_REPUTATION)),
        }
    }

    private getFlags(): bigint {
        return toBigInt(this.sequence.shln(64).addn(
            (this.payOut ? FLAG_PAY_OUT : 0) +
            (this.payIn ? FLAG_PAY_IN : 0) +
            (this.reputation ? FLAG_REPUTATION : 0)
        ));
    }

    offerer: string;
    claimer: string;
    token: string;

    refundHandler: string;
    claimHandler: string;

    //Flags
    payOut: boolean;
    payIn: boolean;
    reputation: boolean;
    sequence: BN;

    claimData: string;
    refundData: string;

    amount: BN;

    feeToken: string;
    securityDeposit: BN;
    claimerBounty: BN;

    extraData: string;

    kind: ChainSwapType;

    constructor(
        offerer: string,
        claimer: string,
        token: string,
        refundHandler: string,
        claimHandler: string,
        payOut: boolean,
        payIn: boolean,
        reputation: boolean,
        sequence: BN,
        claimData: string,
        refundData: string,
        amount: BN,
        feeToken: string,
        securityDeposit: BN,
        claimerBounty: BN,
        kind: ChainSwapType,
        extraData: string
    );

    constructor(data: any);

    constructor(
        offererOrData: string | any,
        claimer?: string,
        token?: string,
        refundHandler?: string,
        claimHandler?: string,
        payOut?: boolean,
        payIn?: boolean,
        reputation?: boolean,
        sequence?: BN,
        claimData?: string,
        refundData?: string,
        amount?: BN,
        feeToken?: string,
        securityDeposit?: BN,
        claimerBounty?: BN,
        kind?: ChainSwapType,
        extraData?: string
    ) {
        super();
        if(claimer!=null || token!=null || refundHandler!=null || claimHandler!=null ||
            payOut!=null || payIn!=null || reputation!=null || sequence!=null || claimData!=null || refundData!=null ||
            amount!=null || feeToken!=null || securityDeposit!=null || claimerBounty!=null) {
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
            this.kind = kind;
            this.extraData = extraData;
        } else {
            this.offerer = offererOrData.offerer;
            this.claimer = offererOrData.claimer;
            this.token = offererOrData.token;
            this.refundHandler = offererOrData.refundHandler;
            this.claimHandler = offererOrData.claimHandler;
            this.payOut = offererOrData.payOut;
            this.payIn = offererOrData.payIn;
            this.reputation = offererOrData.reputation;
            this.sequence = offererOrData.sequence==null ? null : new BN(offererOrData.sequence);
            this.claimData = offererOrData.claimData;
            this.refundData = offererOrData.refundData;
            this.amount = offererOrData.amount==null ? null : new BN(offererOrData.amount);
            this.feeToken = offererOrData.feeToken;
            this.securityDeposit = offererOrData.securityDeposit==null ? null : new BN(offererOrData.securityDeposit);
            this.claimerBounty = offererOrData.claimerBounty==null ? null : new BN(offererOrData.claimerBounty);
            this.kind = offererOrData.kind;
            this.extraData = offererOrData.extraData;
        }
    }

    getOfferer(): string {
        return this.offerer;
    }

    setOfferer(newOfferer: string) {
        this.offerer = newOfferer;
        this.payIn = true;
    }

    getClaimer(): string {
        return this.claimer;
    }

    setClaimer(newClaimer: string) {
        this.claimer = newClaimer;
        this.payIn = false;
        this.payOut = true;
        this.reputation = true;
    }

    serialize(): any {
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
            sequence: this.sequence==null ? null : this.sequence.toString(10),
            claimData: this.claimData,
            refundData: this.refundData,
            amount: this.amount==null ? null : this.amount.toString(10),
            feeToken: this.feeToken,
            securityDeposit: this.securityDeposit==null ? null : this.securityDeposit.toString(10),
            claimerBounty: this.claimerBounty==null ? null : this.claimerBounty.toString(10),
            kind: this.kind,
            extraData: this.extraData
        }
    }

    getAmount(): BN {
        return this.amount;
    }

    getToken(): string {
        return this.token;
    }

    isToken(token: string): boolean {
        return this.token.toLowerCase()===token.toLowerCase();
    }

    getType(): ChainSwapType {
        return this.kind;
    }

    getExpiry(): BN {
        return new BN(TimelockRefundHandler.getExpiry(this).toString(10));
    }

    getConfirmations(): number {return null;}

    getEscrowNonce(): BN {return null;}

    isPayIn(): boolean {
        return this.payIn;
    }

    isPayOut(): boolean {
        return this.payOut;
    }

    getEscrowHash(): string {
        const amountValue = cairo.uint256("0x"+this.amount.toString(16));
        const securityDepositValue = cairo.uint256("0x"+this.securityDeposit.toString(16));
        const claimerBountyValue = cairo.uint256("0x"+this.claimerBounty.toString(16));
        let escrowHash = hash.computePoseidonHashOnElements([
            this.offerer,
            this.claimer,
            this.token,
            this.refundHandler,
            this.claimHandler,
            this.getFlags(),
            toHex(this.claimData),
            toHex(this.refundData),
            amountValue.low,
            amountValue.high,
            this.feeToken,
            securityDepositValue.low,
            securityDepositValue.high,
            claimerBountyValue.low,
            claimerBountyValue.high
        ]);
        if(escrowHash.startsWith("0x")) escrowHash = escrowHash.slice(2);
        return escrowHash.padStart(64, "0");
    }

    getClaimHash(): string {
        let hash = this.claimData;
        if(hash.startsWith("0x")) hash = hash.slice(2);
        return hash.padStart(64, "0");
    }

    getSequence(): BN {
        return this.sequence;
    }

    getConfirmationsHint(): number {
        if(this.extraData==null) return null;
        if(this.extraData.length!=84) return null;
        return parseInt(this.extraData.slice(80), 16);
    }

    getNonceHint(): BN {
        if(this.extraData==null) return null;
        if(this.extraData.length!=84) return null;
        return new BN(this.extraData.slice(64, 80), "hex");
    }

    getTxoHashHint(): string {
        if(this.extraData==null) return null;
        if(this.extraData.length!=84) return null;
        return this.extraData.slice(0, 64);
    }

    getExtraData(): string {
        return this.extraData;
    }

    setExtraData(extraData: string): void {
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

    isClaimer(address: string) {
        return toHex(this.claimer)===toHex(address);
    }

    isOfferer(address: string) {
        return toHex(this.offerer)===toHex(address);
    }

    isRefundHandler(address: string): boolean {
        return toHex(this.refundHandler)===toHex(address);
    }

    isClaimHandler(address: string): boolean {
        return toHex(this.claimHandler)===toHex(address);
    }

    isClaimData(data: string): boolean {
        return toHex(this.claimData)===toHex(data);
    }

    equals(other: StarknetSwapData): boolean {
        return other.offerer.toLowerCase()===this.offerer.toLowerCase() &&
            other.claimer.toLowerCase()===this.claimer.toLowerCase() &&
            other.token.toLowerCase()===this.token.toLowerCase() &&
            other.refundHandler.toLowerCase()===this.refundHandler.toLowerCase() &&
            other.claimHandler.toLowerCase()===this.claimHandler.toLowerCase() &&
            other.payIn===this.payIn &&
            other.payOut===this.payOut &&
            other.reputation===this.reputation &&
            this.sequence.eq(other.sequence) &&
            other.claimData.toLowerCase()===this.claimData.toLowerCase() &&
            other.refundData.toLowerCase()===this.refundData.toLowerCase() &&
            other.amount.eq(this.amount) &&
            other.securityDeposit.eq(this.securityDeposit) &&
            other.claimerBounty.eq(this.claimerBounty)
    }

    toEscrowStruct(): StarknetSwapDataType {
        return {
            offerer: this.offerer,
            claimer: this.claimer,
            token: this.token,
            refund_handler: this.refundHandler,
            claim_handler: this.claimHandler,
            flags: this.getFlags(),
            claim_data: this.claimData,
            refund_data: this.refundData,
            amount: cairo.uint256(toBigInt(this.amount)),
            fee_token: this.feeToken,
            security_deposit: cairo.uint256(toBigInt(this.securityDeposit)),
            claimer_bounty: cairo.uint256(toBigInt(this.claimerBounty))
        }
    }

    static fromSerializedFeltArray(span: BigNumberish[], claimHandlerImpl: IClaimHandler<any, any>) {
        const offerer = toHex(span.shift());
        const claimer = toHex(span.shift());
        const token = toHex(span.shift());
        const refundHandler = toHex(span.shift());
        const claimHandler = toHex(span.shift());
        const {payOut, payIn, reputation, sequence} = StarknetSwapData.toFlags(span.pop());
        const claimData = toHex(span.pop());
        const refundData = toHex(span.pop());
        const amount = toBN({low: span.pop(), high: span.pop()});
        const feeToken = toHex(span.pop());
        const securityDeposit = toBN({low: span.pop(), high: span.pop()});
        const claimerBounty = toBN({low: span.pop(), high: span.pop()});
        return new StarknetSwapData(
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
            claimHandlerImpl.getType(),
            null
        );
    }

}

SwapData.deserializers["strk"] = StarknetSwapData;
