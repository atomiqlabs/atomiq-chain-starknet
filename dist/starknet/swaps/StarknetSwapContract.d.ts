/// <reference types="node" />
import { SolanaSwapData } from "./SolanaSwapData";
import * as BN from "bn.js";
import { Connection, PublicKey, SendOptions } from "@solana/web3.js";
import { SolanaBtcRelay } from "../btcrelay/SolanaBtcRelay";
import { IStorageManager, SwapContract, ChainSwapType, IntermediaryReputationType, SwapCommitStatus, TransactionConfirmationOptions, SignatureData, RelaySynchronizer } from "@atomiqlabs/base";
import { SolanaBtcStoredHeader } from "../btcrelay/headers/SolanaBtcStoredHeader";
import { SolanaFees } from "../base/modules/SolanaFees";
import { SwapProgram } from "./programTypes";
import { SolanaRetryPolicy } from "../base/SolanaBase";
import { SolanaProgramBase } from "../program/SolanaProgramBase";
import { SolanaTx } from "../base/modules/SolanaTransactions";
import { SwapInit, SolanaPreFetchData, SolanaPreFetchVerification } from "./modules/SwapInit";
import { SolanaDataAccount, StoredDataAccount } from "./modules/SolanaDataAccount";
import { SwapRefund } from "./modules/SwapRefund";
import { SwapClaim } from "./modules/SwapClaim";
import { SolanaLpVault } from "./modules/SolanaLpVault";
import { Buffer } from "buffer";
import { SolanaSigner } from "../wallet/SolanaSigner";
export declare class StarknetSwapProgram extends SolanaProgramBase<SwapProgram> implements SwapContract<SolanaSwapData, SolanaTx, never, never, SolanaSigner, "SOLANA"> {
    readonly ESCROW_STATE_RENT_EXEMPT = 2658720;
    readonly SwapVaultAuthority: any;
    readonly SwapVault: any;
    readonly SwapUserVault: any;
    readonly SwapEscrowState: any;
    readonly chainId: "SOLANA";
    readonly claimWithSecretTimeout: number;
    readonly claimWithTxDataTimeout: number;
    readonly refundTimeout: number;
    readonly claimGracePeriod: number;
    readonly refundGracePeriod: number;
    readonly authGracePeriod: number;
    readonly Init: SwapInit;
    readonly Refund: SwapRefund;
    readonly Claim: SwapClaim;
    readonly DataAccount: SolanaDataAccount;
    readonly LpVault: SolanaLpVault;
    constructor(connection: Connection, btcRelay: SolanaBtcRelay<any>, storage: IStorageManager<StoredDataAccount>, programAddress?: string, retryPolicy?: SolanaRetryPolicy, solanaFeeEstimator?: SolanaFees);
    start(): Promise<void>;
    getClaimableDeposits(signer: string): Promise<{
        count: number;
        totalValue: BN;
    }>;
    claimDeposits(signer: SolanaSigner): Promise<{
        txIds: string[];
        count: number;
        totalValue: BN;
    }>;
    preFetchForInitSignatureVerification(data: SolanaPreFetchData): Promise<SolanaPreFetchVerification>;
    preFetchBlockDataForSignatures(): Promise<SolanaPreFetchData>;
    getInitSignature(signer: SolanaSigner, swapData: SolanaSwapData, authorizationTimeout: number, preFetchedBlockData?: SolanaPreFetchData, feeRate?: string): Promise<SignatureData>;
    isValidInitAuthorization(swapData: SolanaSwapData, { timeout, prefix, signature }: {
        timeout: any;
        prefix: any;
        signature: any;
    }, feeRate?: string, preFetchedData?: SolanaPreFetchVerification): Promise<Buffer>;
    getInitAuthorizationExpiry(swapData: SolanaSwapData, { timeout, prefix, signature }: {
        timeout: any;
        prefix: any;
        signature: any;
    }, preFetchedData?: SolanaPreFetchVerification): Promise<number>;
    isInitAuthorizationExpired(swapData: SolanaSwapData, { timeout, prefix, signature }: {
        timeout: any;
        prefix: any;
        signature: any;
    }): Promise<boolean>;
    getRefundSignature(signer: SolanaSigner, swapData: SolanaSwapData, authorizationTimeout: number): Promise<SignatureData>;
    isValidRefundAuthorization(swapData: SolanaSwapData, { timeout, prefix, signature }: {
        timeout: any;
        prefix: any;
        signature: any;
    }): Promise<Buffer>;
    getDataSignature(signer: SolanaSigner, data: Buffer): Promise<string>;
    isValidDataSignature(data: Buffer, signature: string, publicKey: string): Promise<boolean>;
    /**
     * Checks whether the claim is claimable by us, that means not expired, we are claimer & the swap is commited
     *
     * @param signer
     * @param data
     */
    isClaimable(signer: string, data: SolanaSwapData): Promise<boolean>;
    /**
     * Checks whether a swap is commited, i.e. the swap still exists on-chain and was not claimed nor refunded
     *
     * @param swapData
     */
    isCommited(swapData: SolanaSwapData): Promise<boolean>;
    /**
     * Checks whether the swap is expired, takes into consideration possible on-chain time skew, therefore for claimer
     *  the swap expires a bit sooner than it should've & for the offerer it expires a bit later
     *
     * @param signer
     * @param data
     */
    isExpired(signer: string, data: SolanaSwapData): boolean;
    /**
     * Checks if the swap is refundable by us, checks if we are offerer, if the swap is already expired & if the swap
     *  is still commited
     *
     * @param signer
     * @param data
     */
    isRequestRefundable(signer: string, data: SolanaSwapData): Promise<boolean>;
    /**
     * Get the swap payment hash to be used for an on-chain swap, this just uses a sha256 hash of the values
     *
     * @param outputScript output script required to claim the swap
     * @param amount sats sent required to claim the swap
     * @param nonce swap nonce uniquely identifying the transaction to prevent replay attacks
     */
    getHashForOnchain(outputScript: Buffer, amount: BN, nonce: BN): Buffer;
    /**
     * Gets the status of the specific swap, this also checks if we are offerer/claimer & checks for expiry (to see
     *  if swap is refundable)
     *
     * @param signer
     * @param data
     */
    getCommitStatus(signer: string, data: SolanaSwapData): Promise<SwapCommitStatus>;
    /**
     * Checks the status of the specific payment hash
     *
     * @param paymentHash
     */
    getPaymentHashStatus(paymentHash: string): Promise<SwapCommitStatus>;
    /**
     * Returns the data committed for a specific payment hash, or null if no data is currently commited for
     *  the specific swap
     *
     * @param paymentHashHex
     */
    getCommitedData(paymentHashHex: string): Promise<SolanaSwapData>;
    createSwapData(type: ChainSwapType, offerer: string, claimer: string, token: string, amount: BN, paymentHash: string, sequence: BN, expiry: BN, escrowNonce: BN, confirmations: number, payIn: boolean, payOut: boolean, securityDeposit: BN, claimerBounty: BN): Promise<SolanaSwapData>;
    getBalance(signer: string, tokenAddress: string, inContract: boolean): Promise<BN>;
    getIntermediaryData(address: string, token: string): Promise<{
        balance: BN;
        reputation: IntermediaryReputationType;
    }>;
    getIntermediaryReputation(address: string, token: string): Promise<IntermediaryReputationType>;
    getIntermediaryBalance(address: PublicKey, token: PublicKey): Promise<BN>;
    isValidAddress(address: string): boolean;
    getNativeCurrencyAddress(): string;
    txsClaimWithSecret(signer: string | SolanaSigner, swapData: SolanaSwapData, secret: string, checkExpiry?: boolean, initAta?: boolean, feeRate?: string, skipAtaCheck?: boolean): Promise<SolanaTx[]>;
    txsClaimWithTxData(signer: string | SolanaSigner, swapData: SolanaSwapData, blockheight: number, tx: {
        blockhash: string;
        confirmations: number;
        txid: string;
        hex: string;
    }, vout: number, commitedHeader?: SolanaBtcStoredHeader, synchronizer?: RelaySynchronizer<any, SolanaTx, any>, initAta?: boolean, feeRate?: string, storageAccHolder?: {
        storageAcc: PublicKey;
    }): Promise<SolanaTx[] | null>;
    txsRefund(swapData: SolanaSwapData, check?: boolean, initAta?: boolean, feeRate?: string): Promise<SolanaTx[]>;
    txsRefundWithAuthorization(swapData: SolanaSwapData, { timeout, prefix, signature }: {
        timeout: any;
        prefix: any;
        signature: any;
    }, check?: boolean, initAta?: boolean, feeRate?: string): Promise<SolanaTx[]>;
    txsInitPayIn(swapData: SolanaSwapData, { timeout, prefix, signature }: {
        timeout: any;
        prefix: any;
        signature: any;
    }, skipChecks?: boolean, feeRate?: string): Promise<SolanaTx[]>;
    txsInit(swapData: SolanaSwapData, { timeout, prefix, signature }: {
        timeout: any;
        prefix: any;
        signature: any;
    }, txoHash?: Buffer, skipChecks?: boolean, feeRate?: string): Promise<SolanaTx[]>;
    txsWithdraw(signer: string, token: string, amount: BN, feeRate?: string): Promise<SolanaTx[]>;
    txsDeposit(signer: string, token: string, amount: BN, feeRate?: string): Promise<SolanaTx[]>;
    txsTransfer(signer: string, token: string, amount: BN, dstAddress: string, feeRate?: string): Promise<SolanaTx[]>;
    claimWithSecret(signer: SolanaSigner, swapData: SolanaSwapData, secret: string, checkExpiry?: boolean, initAta?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string>;
    claimWithTxData(signer: SolanaSigner, swapData: SolanaSwapData, blockheight: number, tx: {
        blockhash: string;
        confirmations: number;
        txid: string;
        hex: string;
    }, vout: number, commitedHeader?: SolanaBtcStoredHeader, synchronizer?: RelaySynchronizer<any, SolanaTx, any>, initAta?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string>;
    refund(signer: SolanaSigner, swapData: SolanaSwapData, check?: boolean, initAta?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string>;
    refundWithAuthorization(signer: SolanaSigner, swapData: SolanaSwapData, signature: SignatureData, check?: boolean, initAta?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string>;
    initPayIn(signer: SolanaSigner, swapData: SolanaSwapData, signature: SignatureData, skipChecks?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string>;
    init(signer: SolanaSigner, swapData: SolanaSwapData, signature: SignatureData, txoHash?: Buffer, skipChecks?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string>;
    initAndClaimWithSecret(signer: SolanaSigner, swapData: SolanaSwapData, signature: SignatureData, secret: string, skipChecks?: boolean, txOptions?: TransactionConfirmationOptions): Promise<string[]>;
    withdraw(signer: SolanaSigner, token: string, amount: BN, txOptions?: TransactionConfirmationOptions): Promise<string>;
    deposit(signer: SolanaSigner, token: string, amount: BN, txOptions?: TransactionConfirmationOptions): Promise<string>;
    transfer(signer: SolanaSigner, token: string, amount: BN, dstAddress: string, txOptions?: TransactionConfirmationOptions): Promise<string>;
    sendAndConfirm(signer: SolanaSigner, txs: SolanaTx[], waitForConfirmation?: boolean, abortSignal?: AbortSignal, parallel?: boolean, onBeforePublish?: (txId: string, rawTx: string) => Promise<void>): Promise<string[]>;
    serializeTx(tx: SolanaTx): Promise<string>;
    deserializeTx(txData: string): Promise<SolanaTx>;
    getTxIdStatus(txId: string): Promise<"not_found" | "pending" | "success" | "reverted">;
    getTxStatus(tx: string): Promise<"not_found" | "pending" | "success" | "reverted">;
    getInitPayInFeeRate(offerer?: string, claimer?: string, token?: string, paymentHash?: string): Promise<string>;
    getInitFeeRate(offerer?: string, claimer?: string, token?: string, paymentHash?: string): Promise<string>;
    getRefundFeeRate(swapData: SolanaSwapData): Promise<string>;
    getClaimFeeRate(signer: string, swapData: SolanaSwapData): Promise<string>;
    getClaimFee(signer: string, swapData: SolanaSwapData, feeRate?: string): Promise<BN>;
    getRawClaimFee(signer: string, swapData: SolanaSwapData, feeRate?: string): Promise<BN>;
    /**
     * Get the estimated solana fee of the commit transaction
     */
    getCommitFee(swapData: SolanaSwapData, feeRate?: string): Promise<BN>;
    /**
     * Get the estimated solana fee of the commit transaction, without any deposits
     */
    getRawCommitFee(swapData: SolanaSwapData, feeRate?: string): Promise<BN>;
    /**
     * Get the estimated solana transaction fee of the refund transaction
     */
    getRefundFee(swapData: SolanaSwapData, feeRate?: string): Promise<BN>;
    /**
     * Get the estimated solana transaction fee of the refund transaction
     */
    getRawRefundFee(swapData: SolanaSwapData, feeRate?: string): Promise<BN>;
    offBeforeTxReplace(callback: (oldTx: string, oldTxId: string, newTx: string, newTxId: string) => Promise<void>): boolean;
    onBeforeTxReplace(callback: (oldTx: string, oldTxId: string, newTx: string, newTxId: string) => Promise<void>): void;
    onBeforeTxSigned(callback: (tx: SolanaTx) => Promise<void>): void;
    offBeforeTxSigned(callback: (tx: SolanaTx) => Promise<void>): boolean;
    onSendTransaction(callback: (tx: Buffer, options?: SendOptions) => Promise<string>): void;
    offSendTransaction(callback: (tx: Buffer, options?: SendOptions) => Promise<string>): boolean;
    isValidToken(tokenIdentifier: string): boolean;
    randomAddress(): string;
    randomSigner(): SolanaSigner;
}
