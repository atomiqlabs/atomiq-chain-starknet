import { SpvVaultClaimEvent, SpvVaultCloseEvent, SpvVaultData, SpvVaultDepositEvent, SpvVaultOpenEvent, SpvVaultTokenBalance, SpvVaultTokenData } from "@atomiqlabs/base";
import { BigNumberish } from "starknet";
import { Serialized } from "../../utils/Utils";
import { StarknetSpvWithdrawalData } from "./StarknetSpvWithdrawalData";
export type StarknetSpvVaultDataType = {
    relay_contract: BigNumberish;
    token_0: BigNumberish;
    token_1: BigNumberish;
    token_0_multiplier: BigNumberish;
    token_1_multiplier: BigNumberish;
    utxo: Record<number, boolean | object | BigNumberish>;
    confirmations: BigNumberish;
    withdraw_count: BigNumberish;
    deposit_count: BigNumberish;
    token_0_amount: BigNumberish;
    token_1_amount: BigNumberish;
};
export type StarknetSpvVaultDataCtorArgs = {
    owner: string;
    vaultId: bigint;
    struct: StarknetSpvVaultDataType;
    initialUtxo?: string;
};
/**
 * Represents the state of the SPV vault (UTXO-controlled vault)
 *
 * @category Swaps
 */
export declare class StarknetSpvVaultData extends SpvVaultData<StarknetSpvWithdrawalData> {
    readonly owner: string;
    readonly vaultId: bigint;
    readonly relayContract: string;
    readonly token0: {
        token: string;
        multiplier: bigint;
        rawAmount: bigint;
    };
    readonly token1: {
        token: string;
        multiplier: bigint;
        rawAmount: bigint;
    };
    readonly initialUtxo?: string;
    readonly confirmations: number;
    utxo: string;
    withdrawCount: number;
    depositCount: number;
    /**
     * Creates a new spv vault data based on the provided arguments
     *
     * @param args
     */
    constructor(args: StarknetSpvVaultDataCtorArgs);
    /**
     * Deserializes the spv vault data from its serialized implementation (returned from {@link StarknetSpvVaultData.serialize})
     *
     * @param data
     */
    constructor(data: (Serialized<StarknetSpvVaultData> & {
        type: "STARKNET";
    }));
    /**
     * @inheritDoc
     */
    getBalances(): SpvVaultTokenBalance[];
    /**
     * @inheritDoc
     */
    getConfirmations(): number;
    /**
     * @inheritDoc
     */
    getOwner(): string;
    /**
     * @inheritDoc
     */
    getTokenData(): SpvVaultTokenData[];
    /**
     * @inheritDoc
     */
    getUtxo(): string;
    /**
     * @inheritDoc
     */
    getVaultId(): bigint;
    /**
     * @inheritDoc
     */
    getWithdrawalCount(): number;
    /**
     * @inheritDoc
     */
    isOpened(): boolean;
    /**
     * @inheritDoc
     */
    serialize(): (Serialized<StarknetSpvVaultData> & {
        type: "STARKNET";
    });
    /**
     * @inheritDoc
     */
    updateState(withdrawalTxOrEvent: SpvVaultClaimEvent | SpvVaultCloseEvent | SpvVaultOpenEvent | SpvVaultDepositEvent | StarknetSpvWithdrawalData): void;
    /**
     * @inheritDoc
     */
    getDepositCount(): number;
}
