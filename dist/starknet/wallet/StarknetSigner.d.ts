import { AbstractSigner } from "@atomiqlabs/base";
import { Account, DeployAccountContractPayload, Invocation, DeployAccountContractTransaction } from "starknet";
import { StarknetTx, StarknetTxDeployAccount, StarknetTxInvoke } from "../chain/modules/StarknetTransactions";
/**
 * Starknet signer implementation wrapping a starknet.js {@link Account}, for browser
 *  based wallet use {@link StarknetBrowserSigner}
 *
 * @category Wallets
 */
export declare class StarknetSigner implements AbstractSigner {
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
     *
     * @param tx
     * @protected
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
