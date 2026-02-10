import { BitcoinRpc, BtcTx, RelaySynchronizer, SpvVaultContract, SpvVaultTokenData, SpvWithdrawalClaimedState, SpvWithdrawalFrontedState, SpvWithdrawalState, SpvWithdrawalTransactionData, TransactionConfirmationOptions } from "@atomiqlabs/base";
import { Buffer } from "buffer";
import { StarknetTx } from "../chain/modules/StarknetTransactions";
import { StarknetContractBase } from "../contract/StarknetContractBase";
import { StarknetChainInterface } from "../chain/StarknetChainInterface";
import { StarknetBtcRelay } from "../btcrelay/StarknetBtcRelay";
import { StarknetAction } from "../chain/StarknetAction";
import { SpvVaultContractAbi } from "./SpvVaultContractAbi";
import { StarknetSigner } from "../wallet/StarknetSigner";
import { StarknetSpvVaultData } from "./StarknetSpvVaultData";
import { StarknetSpvWithdrawalData } from "./StarknetSpvWithdrawalData";
import { StarknetBtcStoredHeader } from "../btcrelay/headers/StarknetBtcStoredHeader";
/**
 * Starknet SPV vault (UTXO-controlled vault) contract representation
 *
 * @category Swaps
 */
export declare class StarknetSpvVaultContract extends StarknetContractBase<typeof SpvVaultContractAbi> implements SpvVaultContract<StarknetTx, StarknetSigner, "STARKNET", StarknetSpvWithdrawalData, StarknetSpvVaultData> {
    private static readonly GasCosts;
    readonly chainId = "STARKNET";
    readonly btcRelay: StarknetBtcRelay<any>;
    readonly bitcoinRpc: BitcoinRpc<any>;
    readonly claimTimeout: number;
    readonly maxClaimsPerTx: number;
    readonly logger: import("../../utils/Utils").LoggerType;
    constructor(chainInterface: StarknetChainInterface, btcRelay: StarknetBtcRelay<any>, bitcoinRpc: BitcoinRpc<any>, contractAddress?: string, contractDeploymentHeight?: number);
    /**
     * Returns a {@link StarknetAction} that opens up the spv vault with the passed data
     *
     * @param signer A starknet signer's address
     * @param vault Vault data and configuration
     */
    Open(signer: string, vault: StarknetSpvVaultData): StarknetAction;
    /**
     * Returns a {@link StarknetAction} that deposits assets to the spv vault, amounts have to be already scaled!
     *  This also doesn't add the approval call!
     *
     * @param signer A starknet signer's address
     * @param vault Vault data and configuration
     * @param rawAmounts An array of amounts to deposit, since the vault supports 2 tokens, up to 2 amounts are allowed
     */
    Deposit(signer: string, vault: StarknetSpvVaultData, rawAmounts: bigint[]): StarknetAction;
    /**
     * Returns a {@link StarknetAction} that fronts the vault withdrawal. This doesn't add the approval call!
     *
     * @param signer A starknet signer's address
     * @param vault Vault data and configuration
     * @param data Vault withdrawal transaction data to front
     * @param withdrawalSequence Which withdrawal in sequence is this, used to prevent race conditions when 2 parties
     *  were to front at the same time
     */
    Front(signer: string, vault: StarknetSpvVaultData, data: StarknetSpvWithdrawalData, withdrawalSequence: number): StarknetAction;
    /**
     * Returns a {@link StarknetAction} that submits the withdrawal data and executes the vault withdrawal
     *
     * @param signer A starknet signer's address
     * @param vault Vault data and configuration
     * @param data Vault withdrawal transaction data to execute and claim assets based on it
     * @param blockheader A stored and committed bitcoin blockheader where the bitcoin transaction got confirmed
     * @param merkle Merkle proof for the bitcoin transaction
     * @param position Position of the bitcoin transaction in the block - used for the merkle proof verification
     */
    Claim(signer: string, vault: StarknetSpvVaultData, data: StarknetSpvWithdrawalData, blockheader: StarknetBtcStoredHeader, merkle: Buffer[], position: number): StarknetAction;
    /**
     * @inheritDoc
     */
    checkWithdrawalTx(tx: SpvWithdrawalTransactionData): Promise<void>;
    /**
     * @inheritDoc
     */
    createVaultData(owner: string, vaultId: bigint, utxo: string, confirmations: number, tokenData: SpvVaultTokenData[]): Promise<StarknetSpvVaultData>;
    /**
     * @inheritDoc
     */
    getVaultData(owner: string, vaultId: bigint): Promise<StarknetSpvVaultData | null>;
    /**
     * @inheritDoc
     */
    getMultipleVaultData(vaults: {
        owner: string;
        vaultId: bigint;
    }[]): Promise<{
        [owner: string]: {
            [vaultId: string]: StarknetSpvVaultData | null;
        };
    }>;
    /**
     * @inheritDoc
     */
    getVaultLatestUtxo(owner: string, vaultId: bigint): Promise<string | null>;
    /**
     * @inheritDoc
     */
    getVaultLatestUtxos(vaults: {
        owner: string;
        vaultId: bigint;
    }[]): Promise<{
        [owner: string]: {
            [vaultId: string]: string | null;
        };
    }>;
    /**
     * @inheritDoc
     */
    getAllVaults(owner?: string): Promise<StarknetSpvVaultData[]>;
    /**
     * @inheritDoc
     */
    getFronterAddress(owner: string, vaultId: bigint, withdrawal: StarknetSpvWithdrawalData): Promise<string | null>;
    /**
     * @inheritDoc
     */
    getFronterAddresses(withdrawals: {
        owner: string;
        vaultId: bigint;
        withdrawal: StarknetSpvWithdrawalData;
    }[]): Promise<{
        [btcTxId: string]: string | null;
    }>;
    /**
     *
     * @param event
     * @private
     */
    private parseWithdrawalEvent;
    /**
     * @inheritDoc
     */
    getWithdrawalStates(withdrawalTxs: {
        withdrawal: StarknetSpvWithdrawalData;
        scStartBlockheight?: number;
    }[]): Promise<{
        [btcTxId: string]: SpvWithdrawalState;
    }>;
    /**
     * @inheritDoc
     */
    getWithdrawalState(withdrawalTx: StarknetSpvWithdrawalData, scStartBlockheight?: number): Promise<SpvWithdrawalState>;
    getHistoricalWithdrawalStates(recipient: string, startBlockheight?: number): Promise<{
        withdrawals: {
            [btcTxId: string]: SpvWithdrawalClaimedState | SpvWithdrawalFrontedState;
        };
        latestBlockheight?: number;
    }>;
    /**
     * @inheritDoc
     */
    getWithdrawalData(btcTx: BtcTx): Promise<StarknetSpvWithdrawalData>;
    /**
     * @inheritDoc
     */
    fromOpReturnData(data: Buffer): {
        recipient: string;
        rawAmounts: bigint[];
        executionHash?: string;
    };
    /**
     * Parses withdrawal params from OP_RETURN data
     *
     * @param data data as specified in the OP_RETURN output of the transaction
     */
    static fromOpReturnData(data: Buffer): {
        recipient: string;
        rawAmounts: bigint[];
        executionHash?: string;
    };
    /**
     * @inheritDoc
     */
    toOpReturnData(recipient: string, rawAmounts: bigint[], executionHash?: string): Buffer;
    /**
     * Serializes the withdrawal params to the OP_RETURN data
     *
     * @param recipient Recipient of the withdrawn tokens
     * @param rawAmounts Raw amount of tokens to withdraw
     * @param executionHash Optional execution hash of the actions to execute
     */
    static toOpReturnData(recipient: string, rawAmounts: bigint[], executionHash?: string): Buffer;
    /**
     * @inheritDoc
     */
    claim(signer: StarknetSigner, vault: StarknetSpvVaultData, txs: {
        tx: StarknetSpvWithdrawalData;
        storedHeader?: StarknetBtcStoredHeader;
    }[], synchronizer?: RelaySynchronizer<any, any, any>, initAta?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string>;
    /**
     * @inheritDoc
     */
    deposit(signer: StarknetSigner, vault: StarknetSpvVaultData, rawAmounts: bigint[], txOptions?: TransactionConfirmationOptions): Promise<string>;
    /**
     * @inheritDoc
     */
    frontLiquidity(signer: StarknetSigner, vault: StarknetSpvVaultData, realWithdrawalTx: StarknetSpvWithdrawalData, withdrawSequence: number, txOptions?: TransactionConfirmationOptions): Promise<string>;
    /**
     * @inheritDoc
     */
    open(signer: StarknetSigner, vault: StarknetSpvVaultData, txOptions?: TransactionConfirmationOptions): Promise<string>;
    /**
     * @inheritDoc
     */
    txsClaim(signer: string, vault: StarknetSpvVaultData, txs: {
        tx: StarknetSpvWithdrawalData;
        storedHeader?: StarknetBtcStoredHeader;
    }[], synchronizer?: RelaySynchronizer<any, any, any>, initAta?: boolean, feeRate?: string): Promise<StarknetTx[]>;
    /**
     * @inheritDoc
     */
    txsDeposit(signer: string, vault: StarknetSpvVaultData, rawAmounts: bigint[], feeRate?: string): Promise<StarknetTx[]>;
    /**
     * @inheritDoc
     */
    txsFrontLiquidity(signer: string, vault: StarknetSpvVaultData, realWithdrawalTx: StarknetSpvWithdrawalData, withdrawSequence: number, feeRate?: string): Promise<StarknetTx[]>;
    /**
     * @inheritDoc
     */
    txsOpen(signer: string, vault: StarknetSpvVaultData, feeRate?: string): Promise<StarknetTx[]>;
    /**
     * @inheritDoc
     */
    getClaimFee(signer: string, vault: StarknetSpvVaultData, withdrawalData: StarknetSpvWithdrawalData, feeRate?: string): Promise<bigint>;
    /**
     * @inheritDoc
     */
    getFrontFee(signer: string, vault: StarknetSpvVaultData, withdrawalData: StarknetSpvWithdrawalData, feeRate?: string): Promise<bigint>;
}
