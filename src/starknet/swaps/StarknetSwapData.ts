import {SwapData, ChainSwapType} from "@atomiqlabs/base";
import {TimelockRefundHandler} from "./handlers/refund/TimelockRefundHandler";
import {BigNumberish, cairo, CairoOption, CairoOptionVariant, hash} from "starknet";
import {Serialized, toBigInt, toHex} from "../../utils/Utils";
import {
    StringToPrimitiveType
} from "abi-wan-kanabi/dist/kanabi";
import {EscrowManagerAbi} from "./EscrowManagerAbi";
import {IClaimHandler} from "./handlers/claim/ClaimHandlers";

const FLAG_PAY_OUT: bigint = 0x01n;
const FLAG_PAY_IN: bigint = 0x02n;
const FLAG_REPUTATION: bigint = 0x04n;

export type StarknetSwapDataType = StringToPrimitiveType<typeof EscrowManagerAbi, "escrow_manager::structs::escrow::EscrowData">;

/**
 * Represents a success hook/action to be executed upon claim of the swap
 *
 * @category Swaps
 */
export type StarknetSuccessAction = {
    executionHash: string,
    executionExpiry: bigint,
    executionFee: bigint
}

function successActionEquals(a?: StarknetSuccessAction, b?: StarknetSuccessAction): boolean {
    if(a!=null && b!=null) {
        return a.executionHash.toLowerCase()===b.executionHash.toLowerCase() &&
            a.executionExpiry === b.executionExpiry &&
            a.executionFee === b.executionFee;
    }
    return a === b;
}

export type StarknetSwapDataCtorArgs = {
    offerer: string,
    claimer: string,
    token: string,
    refundHandler: string,
    claimHandler: string,
    payOut: boolean,
    payIn: boolean,
    reputation: boolean,
    sequence: bigint,
    claimData: string,
    refundData: string,
    amount: bigint,
    feeToken: string,
    securityDeposit: bigint,
    claimerBounty: bigint,
    kind: ChainSwapType,
    extraData?: string,
    successAction?: StarknetSuccessAction
};

function isSerializedData(obj: any): obj is ({type: "strk"} & Serialized<StarknetSwapData>) {
    return obj.type==="strk";
}

/**
 * Represents swap data for executing PrTLC (on-chain) or HTLC (lightning) based swaps
 *
 * @category Swaps
 */
export class StarknetSwapData extends SwapData {

    /**
     *
     * @param value
     * @private
     */
    private static toFlags(value: number | bigint | string): {payOut: boolean, payIn: boolean, reputation: boolean, sequence: bigint} {
        const val = toBigInt(value);
        return {
            sequence: val >> 64n,
            payOut: (val & FLAG_PAY_OUT) === FLAG_PAY_OUT,
            payIn: (val & FLAG_PAY_IN) === FLAG_PAY_IN,
            reputation: (val & FLAG_REPUTATION) === FLAG_REPUTATION
        }
    }

    /**
     *
     * @private
     */
    private getFlags(): bigint {
        return (this.sequence << 64n) +
            (this.payOut ? FLAG_PAY_OUT : 0n) +
            (this.payIn ? FLAG_PAY_IN : 0n) +
            (this.reputation ? FLAG_REPUTATION : 0n);
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
    sequence: bigint;

    claimData: string;
    refundData: string;

    amount: bigint;

    feeToken: string;
    securityDeposit: bigint;
    claimerBounty: bigint;

    extraData?: string;

    successAction?: StarknetSuccessAction;

    kind: ChainSwapType;

    /**
     * Creates a new swap data based on the provided arguments
     *
     * @param args
     */
    constructor(args: StarknetSwapDataCtorArgs);

    /**
     * Deserializes the spv vault data from its serialized implementation (returned from {@link StarknetSwapData.serialize})
     *
     * @param data
     */
    constructor(data: Serialized<StarknetSwapData> & {type: "strk"});

    constructor(
        data: StarknetSwapDataCtorArgs | (Serialized<StarknetSwapData> & {type: "strk"})
    ) {
        super();
        if(!isSerializedData(data)) {
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
        } else {
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
            this.successAction = data.successAction==null || Array.isArray(data.successAction) ? undefined : {
                executionHash: data.successAction.executionHash,
                executionExpiry: BigInt(data.successAction.executionExpiry),
                executionFee: BigInt(data.successAction.executionFee),
            }
        }
    }

    /**
     * @inheritDoc
     */
    getOfferer(): string {
        return this.offerer;
    }

    /**
     * @inheritDoc
     */
    setOfferer(newOfferer: string) {
        this.offerer = newOfferer;
        this.payIn = true;
    }

    /**
     * @inheritDoc
     */
    getClaimer(): string {
        return this.claimer;
    }

    /**
     * @inheritDoc
     */
    setClaimer(newClaimer: string) {
        this.claimer = newClaimer;
        this.payIn = false;
        this.payOut = true;
        this.reputation = false;
    }

    /**
     * @inheritDoc
     */
    serialize(): Serialized<StarknetSwapData> & {type: "strk"} {
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
            successAction: this.successAction==null ? undefined : {
                executionHash: this.successAction.executionHash,
                executionExpiry: this.successAction.executionExpiry.toString(10),
                executionFee: this.successAction.executionFee.toString(10)
            }
        }
    }

    /**
     * @inheritDoc
     */
    getAmount(): bigint {
        return this.amount;
    }

    /**
     * @inheritDoc
     */
    getToken(): string {
        return this.token;
    }

    /**
     * @inheritDoc
     */
    isToken(token: string): boolean {
        return this.token.toLowerCase()===token.toLowerCase();
    }

    /**
     * @inheritDoc
     */
    getType(): ChainSwapType {
        return this.kind;
    }

    /**
     * @inheritDoc
     */
    getExpiry(): bigint {
        return TimelockRefundHandler.getExpiry(this);
    }

    /**
     * @inheritDoc
     */
    isPayIn(): boolean {
        return this.payIn;
    }

    /**
     * @inheritDoc
     */
    isPayOut(): boolean {
        return this.payOut;
    }

    /**
     * @inheritDoc
     */
    getEscrowHash(): string {
        const amountValue = cairo.uint256("0x"+this.amount.toString(16));
        const securityDepositValue = cairo.uint256("0x"+this.securityDeposit.toString(16));
        const claimerBountyValue = cairo.uint256("0x"+this.claimerBounty.toString(16));
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
        if(this.successAction!=null) {
            elements.push(this.successAction.executionHash);
            elements.push(this.successAction.executionExpiry);
            const feeValue = cairo.uint256("0x"+this.successAction.executionFee.toString(16));
            elements.push(feeValue.low, feeValue.high);
        }

        let escrowHash = hash.computePoseidonHashOnElements(elements);
        if(escrowHash.startsWith("0x")) escrowHash = escrowHash.slice(2);
        return escrowHash.padStart(64, "0");
    }

    /**
     * @inheritDoc
     */
    getClaimHash(): string {
        let hash = this.claimData;
        if(hash.startsWith("0x")) hash = hash.slice(2);
        return hash.padStart(64, "0");
    }

    /**
     * @inheritDoc
     */
    getSequence(): bigint {
        return this.sequence;
    }

    /**
     * @inheritDoc
     */
    getConfirmationsHint(): number | null {
        if(this.extraData==null) return null;
        if(this.extraData.length!=84) return null;
        return parseInt(this.extraData.slice(80), 16);
    }

    /**
     * @inheritDoc
     */
    getNonceHint(): bigint | null {
        if(this.extraData==null) return null;
        if(this.extraData.length!=84) return null;
        return BigInt("0x"+this.extraData.slice(64, 80));
    }

    /**
     * @inheritDoc
     */
    getTxoHashHint(): string | null {
        if(this.extraData==null) return null;
        if(this.extraData.length!=84) return null;
        return this.extraData.slice(0, 64);
    }

    /**
     * @inheritDoc
     */
    getExtraData(): string | null {
        return this.extraData ?? null;
    }

    /**
     * @inheritDoc
     */
    setExtraData(extraData: string): void {
        this.extraData = extraData;
    }

    /**
     * @inheritDoc
     */
    getSecurityDeposit() {
        return this.securityDeposit;
    }

    /**
     * @inheritDoc
     */
    getClaimerBounty() {
        return this.claimerBounty;
    }

    /**
     * @inheritDoc
     */
    getTotalDeposit() {
        return this.claimerBounty < this.securityDeposit ? this.securityDeposit : this.claimerBounty;
    }

    /**
     * @inheritDoc
     */
    getDepositToken() {
        return this.feeToken;
    }

    /**
     * @inheritDoc
     */
    isDepositToken(token: string): boolean {
        if(!token.startsWith("0x")) token = "0x"+token;
        return toHex(this.feeToken)===toHex(token);
    }

    /**
     * @inheritDoc
     */
    isClaimer(address: string) {
        if(!address.startsWith("0x")) address = "0x"+address;
        return toHex(this.claimer)===toHex(address);
    }

    /**
     * @inheritDoc
     */
    isOfferer(address: string) {
        if(!address.startsWith("0x")) address = "0x"+address;
        return toHex(this.offerer)===toHex(address);
    }

    /**
     * Checks whether the passed address is specified as a claim handler for the swap
     *
     * @param address
     */
    isClaimHandler(address: string): boolean {
        if(!address.startsWith("0x")) address = "0x"+address;
        return toHex(this.claimHandler)===toHex(address);
    }

    /**
     * Checks if the passed data match the swap's claim data
     *
     * @param data
     */
    isClaimData(data: string): boolean {
        if(!data.startsWith("0x")) data = "0x"+data;
        return toHex(this.claimData)===toHex(data);
    }

    /**
     * @inheritDoc
     */
    equals(other: StarknetSwapData): boolean {
        return other.offerer.toLowerCase()===this.offerer.toLowerCase() &&
            other.claimer.toLowerCase()===this.claimer.toLowerCase() &&
            other.token.toLowerCase()===this.token.toLowerCase() &&
            other.refundHandler.toLowerCase()===this.refundHandler.toLowerCase() &&
            other.claimHandler.toLowerCase()===this.claimHandler.toLowerCase() &&
            other.payIn===this.payIn &&
            other.payOut===this.payOut &&
            other.reputation===this.reputation &&
            this.sequence === other.sequence &&
            other.claimData.toLowerCase()===this.claimData.toLowerCase() &&
            other.refundData.toLowerCase()===this.refundData.toLowerCase() &&
            other.amount === this.amount &&
            other.securityDeposit === this.securityDeposit &&
            other.claimerBounty === this.claimerBounty &&
            successActionEquals(other.successAction, this.successAction)
    }

    /**
     * Serializes the swap data into starknet.js struct representation
     */
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
            claimer_bounty: cairo.uint256(toBigInt(this.claimerBounty)),
            success_action: new CairoOption(
                this.successAction==null ? CairoOptionVariant.None : CairoOptionVariant.Some,
                this.successAction==null ? undefined : {
                    hash: this.successAction.executionHash,
                    expiry: this.successAction.executionExpiry,
                    fee: cairo.uint256(this.successAction.executionFee)
                }
            ) as StarknetSwapDataType["success_action"]
        }
    }

    /**
     * Deserializes swap data from the provided felt252 array,
     *
     * @param span a felt252 array of length 16 or more
     * @param claimHandlerImpl Claim handler implementation to parse the swap type, this is checked
     *  for internally and this throws an error if the passed `claimHandlerImpl` doesn't match the
     *  claim handler address in the passed swap data
     */
    static fromSerializedFeltArray(span: BigNumberish[], claimHandlerImpl: IClaimHandler<any, any>) {
        if(span.length < 16) throw new Error("Invalid length of serialized starknet swap data!");
        const offerer = toHex(span.shift()!);
        const claimer = toHex(span.shift()!);
        const token = toHex(span.shift()!);
        const refundHandler = toHex(span.shift()!);
        const claimHandler = toHex(span.shift()!);
        const {payOut, payIn, reputation, sequence} = StarknetSwapData.toFlags(span.shift()!);
        const claimData = toHex(span.shift()!);
        const refundData = toHex(span.shift()!);
        const amount = toBigInt({low: span.shift()!, high: span.shift()!});
        const feeToken = toHex(span.shift()!);
        const securityDeposit = toBigInt({low: span.shift()!, high: span.shift()!});
        const claimerBounty = toBigInt({low: span.shift()!, high: span.shift()!});
        const hasSuccessAction = toBigInt(span.shift()!) === 0n;
        let successAction: StarknetSuccessAction | undefined = undefined;
        if(hasSuccessAction) {
            if(span.length < 4) throw new Error("Invalid length of serialized starknet swap data!");
            successAction = {
                executionHash: toHex(span.shift()!),
                executionExpiry: toBigInt(span.shift()!),
                executionFee: toBigInt({low: span.shift()!, high: span.shift()!})
            }
        }

        const swapData = new StarknetSwapData({
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

        if(swapData.isClaimHandler(claimHandlerImpl.address)) throw new Error("Invalid swap handler impl passed!");

        return swapData;
    }

    /**
     * @inheritDoc
     */
    hasSuccessAction(): boolean {
        return this.successAction != null;
    }

}

SwapData.deserializers["strk"] = StarknetSwapData;
