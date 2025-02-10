import {SignatureVerificationError, SwapCommitStatus, SwapDataVerificationError} from "@atomiqlabs/base";
import * as BN from "bn.js";
import {bufferToBytes31Span, toBigInt, toHex, tryWithRetries} from "../../../utils/Utils";
import {Buffer} from "buffer";
import {StarknetSwapData} from "../StarknetSwapData";
import {StarknetAction} from "../../base/StarknetAction";
import {StarknetSwapModule} from "../StarknetSwapModule";
import {BigNumberish} from "starknet";
import {StarknetSigner} from "../../wallet/StarknetSigner";
import {StarknetFees} from "../../base/modules/StarknetFees";
import {StarknetTx} from "../../base/modules/StarknetTransactions";

const Initialize = [
    { name: 'Swap hash', type: 'felt' },
    { name: 'Timeout', type: 'timestamp' }
];

export class StarknetSwapInit extends StarknetSwapModule {

    private static readonly GasCosts = {
        INIT: {l1: 500, l2: 0},
        INIT_PAY_IN: {l1: 1000, l2: 0},
    };

    /**
     * bare Init action based on the data passed in swapData
     *
     * @param swapData
     * @param timeout
     * @param signature
     * @private
     */
    private Init(swapData: StarknetSwapData, timeout: BN, signature: BigNumberish[]): StarknetAction {
        return new StarknetAction(
            swapData.payIn ? swapData.offerer : swapData.claimer,
            this.root,
            this.contract.populateTransaction.initialize(
                swapData.toEscrowStruct(),
                signature,
                toBigInt(timeout),
                swapData.extraData==null || swapData.extraData==="" ? [] : bufferToBytes31Span(Buffer.from(swapData.extraData, "hex")).map(toHex)
            ),
            swapData.payIn ? StarknetSwapInit.GasCosts.INIT_PAY_IN : StarknetSwapInit.GasCosts.INIT
        )
    }

    /**
     * Returns auth prefix to be used with a specific swap, payIn=true & payIn=false use different prefixes (these
     *  actually have no meaning for the smart contract/solana program in the Solana case)
     *
     * @param swapData
     * @private
     */
    private getAuthPrefix(swapData: StarknetSwapData): string {
        return swapData.isPayIn() ? "claim_initialize" : "initialize";
    }

    /**
     * Signs swap initialization authorization, using data from preFetchedBlockData if provided & still valid (subject
     *  to SIGNATURE_PREFETCH_DATA_VALIDITY)
     *
     * @param signer
     * @param swapData
     * @param authorizationTimeout
     * @public
     */
    public async signSwapInitialization(
        signer: StarknetSigner,
        swapData: StarknetSwapData,
        authorizationTimeout: number
    ): Promise<{prefix: string, timeout: string, signature: string}> {
        const authTimeout = Math.floor(Date.now()/1000)+authorizationTimeout;

        const signature = await this.root.Signatures.signTypedMessage(signer, Initialize, "Initialize", {
            "Swap hash": toHex(swapData.getEscrowHash()),
            "Timeout": toHex(authTimeout)
        });

        return {
            prefix: this.getAuthPrefix(swapData),
            timeout: authorizationTimeout.toString(10),
            signature
        };
    }

    /**
     * Checks whether the provided signature data is valid, using preFetchedData if provided and still valid
     *
     * @param swapData
     * @param timeout
     * @param prefix
     * @param signature
     * @public
     */
    public async isSignatureValid(
        swapData: StarknetSwapData,
        timeout: string,
        prefix: string,
        signature: string
    ): Promise<null> {
        const sender = swapData.isPayIn() ? swapData.offerer : swapData.claimer;
        const signer = swapData.isPayIn() ? swapData.claimer : swapData.offerer;

        if(!swapData.isPayIn() && await this.root.isExpired(sender.toString(), swapData)) {
            throw new SignatureVerificationError("Swap will expire too soon!");
        }

        if(prefix!==this.getAuthPrefix(swapData)) throw new SignatureVerificationError("Invalid prefix");

        const currentTimestamp = new BN(Math.floor(Date.now() / 1000));
        const timeoutBN = new BN(timeout);
        const isExpired = timeoutBN.sub(currentTimestamp).lt(new BN(this.root.authGracePeriod));
        if (isExpired) throw new SignatureVerificationError("Authorization expired!");

        const valid = await this.root.Signatures.isValidSignature(signature, signer, Initialize, "Initialize", {
            "Swap hash": toHex(swapData.getEscrowHash()),
            "Timeout": toHex(timeoutBN)
        });

        if(!valid) throw new SignatureVerificationError("Invalid signature!");

        return null;
    }

    /**
     * Gets expiry of the provided signature data, this is a minimum of slot expiry & swap signature expiry
     *
     * @param timeout
     * @public
     */
    public async getSignatureExpiry(
        timeout: string
    ): Promise<number> {
        const now = Date.now();
        const timeoutExpiryTime = (parseInt(timeout)-this.root.authGracePeriod)*1000;

        if(timeoutExpiryTime<now) return 0;

        return timeoutExpiryTime;
    }

    /**
     * Checks whether signature is expired for good, uses expiry + grace period
     *
     * @param timeout
     * @public
     */
    public async isSignatureExpired(
        timeout: string
    ): Promise<boolean> {
        return (parseInt(timeout) + this.root.authGracePeriod) * 1000 < Date.now();
    }

    /**
     * Creates init transaction with a valid signature from an LP
     *
     * @param swapData swap to initialize
     * @param timeout init signature timeout
     * @param prefix init signature prefix
     * @param signature init signature
     * @param skipChecks whether to skip signature validity checks
     * @param feeRate fee rate to use for the transaction
     */
    public async txsInit(
        swapData: StarknetSwapData,
        timeout: string,
        prefix: string,
        signature: string,
        skipChecks?: boolean,
        feeRate?: string
    ): Promise<StarknetTx[]> {
        const sender = swapData.isPayIn() ? swapData.offerer : swapData.claimer;

        if(!skipChecks) {
            const [_, payStatus] = await Promise.all([
                tryWithRetries(
                    () => this.isSignatureValid(swapData, timeout, prefix, signature),
                    this.retryPolicy, (e) => e instanceof SignatureVerificationError
                ),
                tryWithRetries(() => this.root.getCommitStatus(sender, swapData), this.retryPolicy)
            ]);
            if(payStatus!==SwapCommitStatus.NOT_COMMITED) throw new SwapDataVerificationError("Invoice already being paid for or paid");
        }

        feeRate ??= await this.root.Fees.getFeeRate();

        const initAction = this.Init(swapData, new BN(timeout), JSON.parse(signature));
        if(swapData.payIn) initAction.addAction(
            this.root.Tokens.Approve(sender, this.contract.address, swapData.token, swapData.amount), 0
        ); //Add erc20 approve
        if(!swapData.getTotalDeposit().isZero()) initAction.addAction(
            this.root.Tokens.Approve(sender, this.contract.address, swapData.feeToken, swapData.getTotalDeposit()), 0
        ); //Add deposit erc20 approve

        this.logger.debug("txsInitPayIn(): create swap init TX, swap: "+swapData.getClaimHash()+
            " feerate: "+feeRate);

        return [await initAction.tx(feeRate)];
    }

    /**
     * Get the estimated solana fee of the init transaction, this includes the required deposit for creating swap PDA
     *  and also deposit for ATAs
     */
    async getInitFee(swapData?: StarknetSwapData, feeRate?: string): Promise<BN> {
        feeRate ??= await this.root.Fees.getFeeRate();
        return StarknetFees.getGasFee(swapData.payIn ? StarknetSwapInit.GasCosts.INIT_PAY_IN.l1 : StarknetSwapInit.GasCosts.INIT.l1, feeRate);
    }
}