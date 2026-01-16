import { SwapData, ChainSwapType } from "@atomiqlabs/base";
import { BigNumberish } from "starknet";
import { Serialized } from "../../utils/Utils";
import { StringToPrimitiveType } from "abi-wan-kanabi/dist/kanabi";
import { EscrowManagerAbi } from "./EscrowManagerAbi";
import { IClaimHandler } from "./handlers/claim/ClaimHandlers";
export type StarknetSwapDataType = StringToPrimitiveType<typeof EscrowManagerAbi, "escrow_manager::structs::escrow::EscrowData">;
export type StarknetSuccessAction = {
    executionHash: string;
    executionExpiry: bigint;
    executionFee: bigint;
};
export type StarknetSwapDataCtorArgs = {
    offerer: string;
    claimer: string;
    token: string;
    refundHandler: string;
    claimHandler: string;
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
    kind: ChainSwapType;
    extraData?: string;
    successAction?: StarknetSuccessAction;
};
export declare function isSerializedData(obj: any): obj is ({
    type: "strk";
} & Serialized<StarknetSwapData>);
/**
 * @category Swaps
 */
export declare class StarknetSwapData extends SwapData {
    static toFlags(value: number | bigint | string): {
        payOut: boolean;
        payIn: boolean;
        reputation: boolean;
        sequence: bigint;
    };
    private getFlags;
    offerer: string;
    claimer: string;
    token: string;
    refundHandler: string;
    claimHandler: string;
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
    constructor(args: StarknetSwapDataCtorArgs);
    constructor(data: Serialized<StarknetSwapData> & {
        type: "strk";
    });
    getOfferer(): string;
    setOfferer(newOfferer: string): void;
    getClaimer(): string;
    setClaimer(newClaimer: string): void;
    serialize(): Serialized<StarknetSwapData> & {
        type: "strk";
    };
    getAmount(): bigint;
    getToken(): string;
    isToken(token: string): boolean;
    getType(): ChainSwapType;
    getExpiry(): bigint;
    isPayIn(): boolean;
    isPayOut(): boolean;
    getEscrowHash(): string;
    getClaimHash(): string;
    getSequence(): bigint;
    getConfirmationsHint(): number | null;
    getNonceHint(): bigint | null;
    getTxoHashHint(): string | null;
    getExtraData(): string | null;
    setExtraData(extraData: string): void;
    getSecurityDeposit(): bigint;
    getClaimerBounty(): bigint;
    getTotalDeposit(): bigint;
    getDepositToken(): string;
    isDepositToken(token: string): boolean;
    isClaimer(address: string): boolean;
    isOfferer(address: string): boolean;
    isRefundHandler(address: string): boolean;
    isClaimHandler(address: string): boolean;
    isClaimData(data: string): boolean;
    equals(other: StarknetSwapData): boolean;
    toEscrowStruct(): StarknetSwapDataType;
    static fromSerializedFeltArray(span: BigNumberish[], claimHandlerImpl: IClaimHandler<any, any>): StarknetSwapData;
    hasSuccessAction(): boolean;
}
