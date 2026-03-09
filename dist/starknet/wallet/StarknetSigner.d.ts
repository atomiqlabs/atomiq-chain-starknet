import { AbstractSigner } from "@atomiqlabs/base";
import { Account, DeployAccountContractPayload, Invocation, DeployAccountContractTransaction, constants } from "starknet";
import { StarknetTx, StarknetTxDeployAccount, StarknetTxInvoke } from "../chain/modules/StarknetTransactions";
/**
 * Starknet signer implementation wrapping a starknet.js {@link Account}, for browser
 *  based wallet use {@link StarknetBrowserSigner}
 *
 * @category Wallets
 */
export declare class StarknetSigner implements AbstractSigner {
    /**
     * A static message (text message part), which should be signed by the Starknet wallets to generate reproducible entropy. Works when
     *  wallets use signing with deterministic nonce, such that signature over the same message always yields the
     *  same signature (same entropy).
     */
    private static readonly STARKNET_REPRODUCIBLE_ENTROPY_MESSAGE;
    /**
     * A static message (warning part), which should be signed by the Starknet wallets to generate reproducible entropy. Works when
     *  wallets use signing with deterministic nonce, such that signature over the same message always yields the
     *  same signature (same entropy).
     */
    private static readonly STARKNET_REPRODUCIBLE_ENTROPY_WARNING;
    /**
     * Returns a SNIP-12 message to be signed for extracting reproducible entropy. Works when wallets use signing with
     *  deterministic nonce, such that signature over the same message always yields the same signature (same entropy).
     *
     * @param starknetChainId Starknet chain ID to use for the SNIP-12 message
     * @param appName Application name to differentiate reproducible entropy generated across different apps
     */
    static getReproducibleEntropyMessage(starknetChainId: constants.StarknetChainId, appName: string): {
        types: {
            StarknetDomain: {
                name: string;
                type: string;
            }[];
            Message: {
                name: string;
                type: string;
            }[];
        };
        primaryType: string;
        domain: {
            name: string;
            version: string;
            chainId: string;
            revision: string;
        };
        message: {
            Message: string;
            Warning: string;
        };
    };
    type: "AtomiqAbstractSigner";
    readonly isManagingNoncesInternally: boolean;
    readonly account: Account;
    /**
     * Constructs a signer wrapping a starknet.js {@link Account}
     *
     * @param account
     */
    constructor(account: Account);
    constructor(account: Account, isManagingNoncesInternally?: boolean);
    /**
     * @inheritDoc
     */
    getAddress(): string;
    /**
     * @param tx
     * @internal
     */
    protected _signTransaction(tx: StarknetTx): Promise<StarknetTx>;
    /**
     * Signs the provided starknet transaction and returns its signed version
     *
     * @param tx A starknet transaction to sign
     */
    signTransaction?(tx: StarknetTx): Promise<StarknetTx>;
    /**
     *
     * @param tx
     * @protected
     */
    protected signInvoke(tx: StarknetTxInvoke): Promise<Invocation>;
    /**
     * @param tx
     * @protected
     */
    protected signDeployAccount(tx: StarknetTxDeployAccount): Promise<DeployAccountContractTransaction>;
    /**
     * Signs and sends the provided starknet transaction. Note that onBeforePublish is not really called before the
     *  tx is sent out in this default case, since this is not supported by the starknet web based wallets
     *
     * @param tx A transaction to sign and send
     * @param onBeforePublish A callback called after the transaction has been sent
     */
    sendTransaction(tx: StarknetTx, onBeforePublish?: (txId: string, rawTx: string) => Promise<void>): Promise<string>;
    /**
     *
     * @param tx
     * @protected
     */
    protected sendInvoke(tx: StarknetTxInvoke): Promise<string>;
    /**
     *
     * @param tx
     * @protected
     */
    protected sendDeployAccount(tx: StarknetTxDeployAccount): Promise<string>;
    /**
     * Returns the payload for deploying the signer account's contract on Starknet
     */
    getDeployPayload(): Promise<DeployAccountContractPayload | null>;
}
