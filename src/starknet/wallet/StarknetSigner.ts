import {AbstractSigner} from "@atomiqlabs/base";
import {Account, DeployAccountContractPayload, BlockTag, Invocation, DeployAccountContractTransaction} from "starknet";
import {calculateHash, toHex} from "../../utils/Utils";
import {
    isStarknetTxDeployAccount,
    isStarknetTxInvoke, StarknetTransactions,
    StarknetTx,
    StarknetTxDeployAccount,
    StarknetTxInvoke
} from "../chain/modules/StarknetTransactions";

/**
 * Starknet signer implementation wrapping a starknet.js {@link Account}, for browser
 *  based wallet use {@link StarknetBrowserSigner}
 *
 * @category Wallets
 */
export class StarknetSigner implements AbstractSigner {
    type = "AtomiqAbstractSigner" as const;

    public readonly isManagingNoncesInternally: boolean;
    readonly account: Account;

    /**
     * Constructs a signer wrapping a starknet.js {@link Account}
     *
     * @param account
     */
    constructor(account: Account);
    constructor(account: Account, isManagingNoncesInternally?: boolean);
    constructor(account: Account, isManagingNoncesInternally: boolean = false) {
        this.account = account;
        this.isManagingNoncesInternally = isManagingNoncesInternally;
    }

    /**
     * @inheritDoc
     */
    getAddress(): string {
        return toHex(this.account.address);
    }

    /**
     *
     * @param tx
     * @protected
     */
    protected async _signTransaction(tx: StarknetTx): Promise<StarknetTx> {
        if(isStarknetTxInvoke(tx)) {
            tx.signed = await this.signInvoke(tx);
        } else if(isStarknetTxDeployAccount(tx)) {
            tx.signed = await this.signDeployAccount(tx);
        } else {
            throw new Error("Unsupported transaction type!");
        }
        calculateHash(tx);
        return tx;
    }

    /**
     * Signs the provided starknet transaction and returns its signed version
     *
     * @param tx A starknet transaction to sign
     */
    signTransaction?(tx: StarknetTx): Promise<StarknetTx> {
        return this._signTransaction(tx);
    }

    /**
     *
     * @param tx
     * @protected
     */
    protected signInvoke(tx: StarknetTxInvoke): Promise<Invocation> {
        return this.account.buildInvocation(tx.tx, tx.details);
    }

    /**
     * @param tx
     * @protected
     */
    protected signDeployAccount(tx: StarknetTxDeployAccount): Promise<DeployAccountContractTransaction> {
        return this.account.buildAccountDeployPayload(tx.tx, tx.details);
    }

    /**
     * Signs and sends the provided starknet transaction. Note that onBeforePublish is not really called before the
     *  tx is sent out in this default case, since this is not supported by the starknet web based wallets
     *
     * @param tx A transaction to sign and send
     * @param onBeforePublish A callback called after the transaction has been sent
     */
    async sendTransaction(tx: StarknetTx, onBeforePublish?: (txId: string, rawTx: string) => Promise<void>): Promise<string> {
        if(isStarknetTxInvoke(tx)) {
            tx.txId = await this.sendInvoke(tx);
        } else if(isStarknetTxDeployAccount(tx)) {
            tx.txId = await this.sendDeployAccount(tx);
        } else {
            throw new Error("Unsupported transaction type!");
        }
        if(onBeforePublish!=null) await onBeforePublish(tx.txId, StarknetTransactions.serializeTx(tx));
        return tx.txId;
    }

    /**
     *
     * @param tx
     * @protected
     */
    protected async sendInvoke(tx: StarknetTxInvoke): Promise<string> {
        const result = await this.account.execute(tx.tx, tx.details);
        return result.transaction_hash;
    }

    /**
     *
     * @param tx
     * @protected
     */
    protected async sendDeployAccount(tx: StarknetTxDeployAccount): Promise<string> {
        const result = await this.account.deployAccount(tx.tx, tx.details);
        return result.transaction_hash;
    }

    /**
     * Returns the payload for deploying the signer account's contract on Starknet
     */
    async getDeployPayload(): Promise<DeployAccountContractPayload | null> {
        const _account: Account & {getDeploymentData?: () => DeployAccountContractPayload} = this.account;
        if(_account.getDeploymentData==null) return null;
        return _account.getDeploymentData();
    }

}
