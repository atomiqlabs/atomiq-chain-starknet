import { SwapData, ChainSwapType } from "@atomiqlabs/base";
import { BigNumberish } from "starknet";
import { Serialized } from "../../utils/Utils";
import { StringToPrimitiveType } from "abi-wan-kanabi/dist/kanabi";
import { EscrowManagerAbi } from "./EscrowManagerAbi";
import { IClaimHandler } from "./handlers/claim/ClaimHandlers";
export type StarknetSwapDataType = StringToPrimitiveType<typeof EscrowManagerAbi, "escrow_manager::structs::escrow::EscrowData">;
/**
 * Represents a success hook/action to be executed upon claim of the swap
 *
 * @category Swaps
 */
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
/**
 * Represents swap data for executing PrTLC (on-chain) or HTLC (lightning) based swaps
 *
 * @category Swaps
 */
export declare class StarknetSwapData extends SwapData {
    /**
     *
     * @param value
     * @private
     */
    private static toFlags;
    /**
     *
     * @private
     */
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
    constructor(data: Serialized<StarknetSwapData> & {
        type: "strk";
    });
    /**
     * @inheritDoc
     */
    getOfferer(): string;
    /**
     * @inheritDoc
     */
    setOfferer(newOfferer: string): void;
    /**
     * @inheritDoc
     */
    getClaimer(): string;
    /**
     * @inheritDoc
     */
    setClaimer(newClaimer: string): void;
    /**
     * @inheritDoc
     */
    serialize(): Serialized<StarknetSwapData> & {
        type: "strk";
    };
    /**
     * @inheritDoc
     */
    getAmount(): bigint;
    /**
     * @inheritDoc
     */
    getToken(): string;
    /**
     * @inheritDoc
     */
    isToken(token: string): boolean;
    /**
     * @inheritDoc
     */
    getType(): ChainSwapType;
    /**
     * @inheritDoc
     */
    getExpiry(): bigint;
    /**
     * @inheritDoc
     */
    isPayIn(): boolean;
    /**
     * @inheritDoc
     */
    isPayOut(): boolean;
    /**
     * @inheritDoc
     */
    isTrackingReputation(): boolean;
    /**
     * @inheritDoc
     */
    getEscrowHash(): string;
    /**
     * @inheritDoc
     */
    getClaimHash(): string;
    /**
     * @inheritDoc
     */
    getSequence(): bigint;
    /**
     * @inheritDoc
     */
    getConfirmationsHint(): number | null;
    /**
     * @inheritDoc
     */
    getNonceHint(): bigint | null;
    /**
     * @inheritDoc
     */
    getTxoHashHint(): string | null;
    /**
     * @inheritDoc
     */
    getExtraData(): string | null;
    /**
     * @inheritDoc
     */
    setExtraData(extraData: string): void;
    /**
     * @inheritDoc
     */
    getSecurityDeposit(): bigint;
    /**
     * @inheritDoc
     */
    getClaimerBounty(): bigint;
    /**
     * @inheritDoc
     */
    getTotalDeposit(): bigint;
    /**
     * @inheritDoc
     */
    getDepositToken(): string;
    /**
     * @inheritDoc
     */
    isDepositToken(token: string): boolean;
    /**
     * @inheritDoc
     */
    isClaimer(address: string): boolean;
    /**
     * @inheritDoc
     */
    isOfferer(address: string): boolean;
    /**
     * Checks whether the passed address is specified as a claim handler for the swap
     *
     * @param address
     */
    isClaimHandler(address: string): boolean;
    /**
     * Checks if the passed data match the swap's claim data
     *
     * @param data
     */
    isClaimData(data: string): boolean;
    /**
     * @inheritDoc
     */
    equals(other: StarknetSwapData): boolean;
    /**
     * Serializes the swap data into starknet.js struct representation
     */
    toEscrowStruct(): StarknetSwapDataType;
    /**
     * Deserializes swap data from the provided felt252 array,
     *
     * @param span a felt252 array of length 16 or more
     * @param claimHandlerImpl Claim handler implementation to parse the swap type, this is checked
     *  for internally and this throws an error if the passed `claimHandlerImpl` doesn't match the
     *  claim handler address in the passed swap data
     */
    static fromSerializedFeltArray(span: BigNumberish[], claimHandlerImpl: IClaimHandler<any, any>): StarknetSwapData;
    /**
     * @inheritDoc
     */
    hasSuccessAction(): boolean;
}
