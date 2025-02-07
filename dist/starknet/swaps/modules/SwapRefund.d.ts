import * as BN from "bn.js";
import { StarknetSwapModule } from "../StarknetSwapModule";
import { StarknetSwapData } from "../StarknetSwapData";
import { StarknetSwapContract } from "../StarknetSwapContract";
import { IHandler } from "../handlers/IHandler";
import { StarknetTx } from "../../base/modules/StarknetTransactions";
import { StarknetSigner } from "../../wallet/StarknetSigner";
export declare class SwapRefund extends StarknetSwapModule {
    private static readonly GasCosts;
    readonly refundHandlers: {
        [address: string]: IHandler<any, any>;
    };
    /**
     * Action for generic Refund instruction
     *
     * @param signer
     * @param swapData
     * @param witness
     * @param handlerGas
     * @constructor
     * @private
     */
    private Refund;
    /**
     * Action for cooperative refunding with signature
     *
     * @param sender
     * @param swapData
     * @param timeout
     * @param signature
     * @constructor
     * @private
     */
    private RefundWithSignature;
    constructor(root: StarknetSwapContract);
    signSwapRefund(signer: StarknetSigner, swapData: StarknetSwapData, authorizationTimeout: number): Promise<{
        prefix: string;
        timeout: string;
        signature: string;
    }>;
    isSignatureValid(swapData: StarknetSwapData, timeout: string, prefix: string, signature: string): Promise<null>;
    /**
     * Creates transactions required for refunding timed out swap
     *
     * @param swapData swap data to refund
     * @param check whether to check if swap is already expired and refundable
     * @param feeRate fee rate to be used for the transactions
     * @param witnessData
     */
    txsRefund<T>(swapData: StarknetSwapData, check?: boolean, feeRate?: string, witnessData?: T): Promise<StarknetTx[]>;
    /**
     * Creates transactions required for refunding the swap with authorization signature, also unwraps WSOL to SOL
     *
     * @param swapData swap data to refund
     * @param timeout signature timeout
     * @param prefix signature prefix of the counterparty
     * @param signature signature of the counterparty
     * @param check whether to check if swap is committed before attempting refund
     * @param feeRate fee rate to be used for the transactions
     */
    txsRefundWithAuthorization(swapData: StarknetSwapData, timeout: string, prefix: string, signature: string, check?: boolean, feeRate?: string): Promise<StarknetTx[]>;
    /**
     * Get the estimated solana transaction fee of the refund transaction, in the worst case scenario in case where the
     *  ATA needs to be initialized again (i.e. adding the ATA rent exempt lamports to the fee)
     */
    getRefundFee(swapData: StarknetSwapData, feeRate?: string): Promise<BN>;
}
