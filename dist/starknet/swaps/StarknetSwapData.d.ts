import * as BN from "bn.js";
import { SwapData, ChainSwapType } from "@atomiqlabs/base";
import { BigNumberish } from "starknet";
import { StringToPrimitiveType } from "abi-wan-kanabi/dist/kanabi";
import { EscrowManagerAbi } from "./EscrowManagerAbi";
import { IClaimHandler } from "./handlers/claim/ClaimHandlers";
export type StarknetSwapDataType = StringToPrimitiveType<typeof EscrowManagerAbi, "escrow_manager::structs::escrow::EscrowData">;
type SerializedContractCall = {
    address: string;
    entrypoint: string;
    calldata: string[];
};
export declare class StarknetSwapData extends SwapData {
    static toFlags(value: number | bigint | string): {
        payOut: boolean;
        payIn: boolean;
        reputation: boolean;
        sequence: BN;
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
    sequence: BN;
    claimData: string;
    refundData: string;
    amount: BN;
    feeToken: string;
    securityDeposit: BN;
    claimerBounty: BN;
    successAction: SerializedContractCall[];
    extraData: string;
    kind: ChainSwapType;
    constructor(offerer: string, claimer: string, token: string, refundHandler: string, claimHandler: string, payOut: boolean, payIn: boolean, reputation: boolean, sequence: BN, claimData: string, refundData: string, amount: BN, feeToken: string, securityDeposit: BN, claimerBounty: BN, kind: ChainSwapType, extraData: string, successAction: SerializedContractCall[]);
    constructor(data: any);
    getOfferer(): string;
    setOfferer(newOfferer: string): void;
    getClaimer(): string;
    setClaimer(newClaimer: string): void;
    serialize(): any;
    getAmount(): BN;
    getToken(): string;
    isToken(token: string): boolean;
    getType(): ChainSwapType;
    getExpiry(): BN;
    isPayIn(): boolean;
    isPayOut(): boolean;
    getEscrowHash(): string;
    getClaimHash(): string;
    getSequence(): BN;
    getConfirmationsHint(): number;
    getNonceHint(): BN;
    getTxoHashHint(): string;
    getExtraData(): string;
    setExtraData(extraData: string): void;
    getSecurityDeposit(): BN;
    getClaimerBounty(): BN;
    getTotalDeposit(): BN;
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
}
export {};
