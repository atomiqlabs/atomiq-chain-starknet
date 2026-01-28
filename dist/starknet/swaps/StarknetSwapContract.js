"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetSwapContract = void 0;
const base_1 = require("@atomiqlabs/base");
const buffer_1 = require("buffer");
const EscrowManagerAbi_1 = require("./EscrowManagerAbi");
const StarknetContractBase_1 = require("../contract/StarknetContractBase");
const starknet_1 = require("starknet");
const StarknetSwapData_1 = require("./StarknetSwapData");
const Utils_1 = require("../../utils/Utils");
const TimelockRefundHandler_1 = require("./handlers/refund/TimelockRefundHandler");
const StarknetLpVault_1 = require("./modules/StarknetLpVault");
const StarknetSwapInit_1 = require("./modules/StarknetSwapInit");
const StarknetSwapRefund_1 = require("./modules/StarknetSwapRefund");
const ClaimHandlers_1 = require("./handlers/claim/ClaimHandlers");
const StarknetSwapClaim_1 = require("./modules/StarknetSwapClaim");
const sha2_1 = require("@noble/hashes/sha2");
const ESCROW_STATE_COMMITTED = 1;
const ESCROW_STATE_CLAIMED = 2;
const ESCROW_STATE_REFUNDED = 3;
const swapContractAddreses = {
    [starknet_1.constants.StarknetChainId.SN_SEPOLIA]: "0x017bf50dd28b6d823a231355bb25813d4396c8e19d2df03026038714a22f0413",
    [starknet_1.constants.StarknetChainId.SN_MAIN]: "0x04f278e1f19e495c3b1dd35ef307c4f7510768ed95481958fbae588bd173f79a"
};
const defaultClaimAddresses = {
    [starknet_1.constants.StarknetChainId.SN_SEPOLIA]: {
        [base_1.ChainSwapType.HTLC]: "0x04a57ea54d4637c352aad1bbee046868926a11702216a0aaf7eeec1568be2d7b",
        [base_1.ChainSwapType.CHAIN_TXID]: "0x04c7cde88359e14b6f6f779f8b9d8310cee37e91a6f143f855ae29fab33c396e",
        [base_1.ChainSwapType.CHAIN]: "0x051bef6f5fd12e2832a7d38653bdfc8eb84ba7eb7a4aada5b87ef38a9999cf17",
        [base_1.ChainSwapType.CHAIN_NONCED]: "0x050e50eacd16da414f2c3a7c3570fd5e248974c6fe757d41acbf72d2836fa0a1"
    },
    [starknet_1.constants.StarknetChainId.SN_MAIN]: {
        [base_1.ChainSwapType.HTLC]: "0x07b74b50a883ebee262b6db0e3c0c697670c6f30e3d610e75faf33a89c46aa2a",
        [base_1.ChainSwapType.CHAIN_TXID]: "0x016c2db2b03f39cf4fd7f871035000f66b62307d9983056e33a38315da8a44dc",
        [base_1.ChainSwapType.CHAIN]: "0x02c45a81c4a48d0645a0a199e620061e8a55dcc9c2b5946d050eaeeddba64e9a",
        [base_1.ChainSwapType.CHAIN_NONCED]: "0x0019b5480dd7ed8ded10a09437b0a7a30b8997b4ef139deb24ff8c86f995d84f"
    }
};
const defaultRefundAddresses = {
    [starknet_1.constants.StarknetChainId.SN_SEPOLIA]: {
        timelock: "0x034b8f28b3ca979036cb2849cfa3af7f67207459224b6ca5ce2474aa398ec3e7"
    },
    [starknet_1.constants.StarknetChainId.SN_MAIN]: {
        timelock: "0x06a59659990c2aefbf7239f6d911617b3ae60b79cb3364f3bd242a6ca8f4f4f7"
    }
};
/**
 * Starknet swap contract (escrow manager) contract representation handling PrTLC (on-chain) and HTLC (lightning)
 *  based swaps
 *
 * @category Swaps
 */
class StarknetSwapContract extends StarknetContractBase_1.StarknetContractBase {
    /**
     * Constructs the swap contract (escrow manager)
     *
     * @param chainInterface Underlying chain interface to use
     * @param btcRelay Btc relay light client contract
     * @param contractAddress Optional underlying contract address (default is used otherwise)
     * @param _handlerAddresses Optional handler addresses (defaults are used otherwise)
     */
    constructor(chainInterface, btcRelay, contractAddress = swapContractAddreses[chainInterface.starknetChainId], _handlerAddresses) {
        super(chainInterface, contractAddress, EscrowManagerAbi_1.EscrowManagerAbi);
        /**
         * @inheritDoc
         */
        this.supportsInitWithoutClaimer = true;
        ////////////////////////
        //// Constants
        this.chainId = "STARKNET";
        ////////////////////////
        //// Timeouts
        /**
         * @inheritDoc
         */
        this.claimWithSecretTimeout = 180;
        /**
         * @inheritDoc
         */
        this.claimWithTxDataTimeout = 180;
        /**
         * @inheritDoc
         */
        this.refundTimeout = 180;
        this.claimGracePeriod = 10 * 60;
        this.refundGracePeriod = 10 * 60;
        /**
         * @private
         */
        this.authGracePeriod = 30;
        ////////////////////////
        //// Handlers
        this.claimHandlersByAddress = {};
        this.claimHandlersBySwapType = {};
        this.refundHandlersByAddress = {};
        this.Init = new StarknetSwapInit_1.StarknetSwapInit(chainInterface, this);
        this.Refund = new StarknetSwapRefund_1.StarknetSwapRefund(chainInterface, this);
        this.Claim = new StarknetSwapClaim_1.StarknetSwapClaim(chainInterface, this);
        this.LpVault = new StarknetLpVault_1.StarknetLpVault(chainInterface, this);
        this.btcRelay = btcRelay;
        const handlerAddresses = {
            refund: { ...defaultRefundAddresses[chainInterface.starknetChainId], ..._handlerAddresses?.refund },
            claim: { ...defaultClaimAddresses[chainInterface.starknetChainId], ..._handlerAddresses?.claim }
        };
        ClaimHandlers_1.claimHandlersList.forEach(handlerCtor => {
            const handler = new handlerCtor(handlerAddresses.claim[handlerCtor.type]);
            this.claimHandlersByAddress[(0, Utils_1.toHex)(handler.address)] = handler;
            this.claimHandlersBySwapType[handlerCtor.type] = handler;
        });
        this.timelockRefundHandler = new TimelockRefundHandler_1.TimelockRefundHandler(handlerAddresses.refund.timelock);
        this.refundHandlersByAddress[this.timelockRefundHandler.address] = this.timelockRefundHandler;
    }
    /**
     * @inheritDoc
     */
    async start() {
    }
    ////////////////////////////////////////////
    //// Signatures
    /**
     * @inheritDoc
     */
    preFetchForInitSignatureVerification() {
        return this.Init.preFetchForInitSignatureVerification();
    }
    /**
     * @inheritDoc
     */
    getInitSignature(signer, swapData, authorizationTimeout, preFetchedBlockData, feeRate) {
        return this.Init.signSwapInitialization(signer, swapData, authorizationTimeout);
    }
    /**
     * @inheritDoc
     */
    isValidInitAuthorization(sender, swapData, sig, feeRate, preFetchedData) {
        return this.Init.isSignatureValid(sender, swapData, sig.timeout, sig.prefix, sig.signature, preFetchedData);
    }
    /**
     * @inheritDoc
     */
    getInitAuthorizationExpiry(swapData, sig, preFetchedData) {
        return this.Init.getSignatureExpiry(sig.timeout);
    }
    /**
     * @inheritDoc
     */
    isInitAuthorizationExpired(swapData, sig) {
        return this.Init.isSignatureExpired(sig.timeout);
    }
    /**
     * @inheritDoc
     */
    getRefundSignature(signer, swapData, authorizationTimeout) {
        return this.Refund.signSwapRefund(signer, swapData, authorizationTimeout);
    }
    /**
     * @inheritDoc
     */
    isValidRefundAuthorization(swapData, sig) {
        return this.Refund.isSignatureValid(swapData, sig.timeout, sig.prefix, sig.signature);
    }
    /**
     * @inheritDoc
     */
    getDataSignature(signer, data) {
        return this.Chain.Signatures.getDataSignature(signer, data);
    }
    /**
     * @inheritDoc
     */
    isValidDataSignature(data, signature, publicKey) {
        return this.Chain.Signatures.isValidDataSignature(data, signature, publicKey);
    }
    ////////////////////////////////////////////
    //// Swap data utils
    /**
     * @inheritDoc
     */
    async isClaimable(signer, data) {
        if (!data.isClaimer(signer))
            return false;
        if (await this.isExpired(signer, data))
            return false;
        return await this.isCommited(data);
    }
    /**
     * @inheritDoc
     */
    async isCommited(swapData) {
        const data = await this.contract.get_hash_state("0x" + swapData.getEscrowHash());
        return Number(data.state) === ESCROW_STATE_COMMITTED;
    }
    /**
     * @inheritDoc
     */
    isExpired(signer, data) {
        let currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
        if (data.isClaimer(signer))
            currentTimestamp = currentTimestamp + BigInt(this.claimGracePeriod);
        if (data.isOfferer(signer))
            currentTimestamp = currentTimestamp - BigInt(this.refundGracePeriod);
        return Promise.resolve(data.getExpiry() < currentTimestamp);
    }
    /**
     * @inheritDoc
     */
    async isRequestRefundable(signer, data) {
        //Swap can only be refunded by the offerer
        if (!data.isOfferer(signer))
            return false;
        if (!(await this.isExpired(signer, data)))
            return false;
        return await this.isCommited(data);
    }
    /**
     * @inheritDoc
     */
    getHashForTxId(txId, confirmations) {
        const chainTxIdHandler = this.claimHandlersBySwapType[base_1.ChainSwapType.CHAIN_TXID];
        if (chainTxIdHandler == null)
            throw new Error("Claim handler for CHAIN_TXID not found!");
        return (0, Utils_1.bigNumberishToBuffer)(chainTxIdHandler.getCommitment({
            txId,
            confirmations,
            btcRelay: this.btcRelay
        }), 32);
    }
    /**
     * @inheritDoc
     */
    getHashForOnchain(outputScript, amount, confirmations, nonce) {
        let result;
        if (nonce == null || nonce === 0n) {
            const chainHandler = this.claimHandlersBySwapType[base_1.ChainSwapType.CHAIN];
            if (chainHandler == null)
                throw new Error("Claim handler for CHAIN not found!");
            result = chainHandler.getCommitment({
                output: outputScript,
                amount,
                confirmations,
                btcRelay: this.btcRelay
            });
        }
        else {
            const chainNoncedHandler = this.claimHandlersBySwapType[base_1.ChainSwapType.CHAIN_NONCED];
            if (chainNoncedHandler == null)
                throw new Error("Claim handler for CHAIN_NONCED not found!");
            result = chainNoncedHandler.getCommitment({
                output: outputScript,
                amount,
                nonce,
                confirmations,
                btcRelay: this.btcRelay
            });
        }
        return (0, Utils_1.bigNumberishToBuffer)(result, 32);
    }
    /**
     * @inheritDoc
     */
    getHashForHtlc(paymentHash) {
        const htlcHandler = this.claimHandlersBySwapType[base_1.ChainSwapType.HTLC];
        if (htlcHandler == null)
            throw new Error("Claim handler for HTLC not found!");
        return (0, Utils_1.bigNumberishToBuffer)(htlcHandler.getCommitment(paymentHash), 32);
    }
    /**
     * @inheritDoc
     */
    getExtraData(outputScript, amount, confirmations, nonce) {
        if (nonce == null)
            nonce = 0n;
        const txoHash = buffer_1.Buffer.from((0, sha2_1.sha256)(buffer_1.Buffer.concat([
            base_1.BigIntBufferUtils.toBuffer(amount, "le", 8),
            outputScript
        ])));
        return buffer_1.Buffer.concat([
            txoHash,
            base_1.BigIntBufferUtils.toBuffer(nonce, "be", 8),
            base_1.BigIntBufferUtils.toBuffer(BigInt(confirmations), "be", 2)
        ]);
    }
    ////////////////////////////////////////////
    //// Swap data getters
    /**
     * @inheritDoc
     */
    async getCommitStatus(signer, data) {
        const escrowHash = data.getEscrowHash();
        const stateData = await this.contract.get_hash_state("0x" + escrowHash);
        const state = Number(stateData.state);
        const blockHeight = Number(stateData.finish_blockheight);
        switch (state) {
            case ESCROW_STATE_COMMITTED:
                if (data.isOfferer(signer) && await this.isExpired(signer, data))
                    return { type: base_1.SwapCommitStateType.REFUNDABLE };
                return { type: base_1.SwapCommitStateType.COMMITED };
            case ESCROW_STATE_CLAIMED:
                return {
                    type: base_1.SwapCommitStateType.PAID,
                    getTxBlock: async () => {
                        return {
                            blockTime: await this.Chain.Blocks.getBlockTime(blockHeight),
                            blockHeight: blockHeight
                        };
                    },
                    getClaimTxId: async () => {
                        const events = await this.Events.getContractBlockEvents(["escrow_manager::events::Claim"], [null, null, null, "0x" + escrowHash], blockHeight, blockHeight);
                        if (events.length === 0)
                            throw new Error("Claim event not found!");
                        return events[0].txHash;
                    },
                    getClaimResult: async () => {
                        const events = await this.Events.getContractBlockEvents(["escrow_manager::events::Claim"], [null, null, null, "0x" + escrowHash], blockHeight, blockHeight);
                        if (events.length === 0)
                            throw new Error("Claim event not found!");
                        const event = events[0];
                        const claimHandlerHex = (0, Utils_1.toHex)(event.params.claim_handler);
                        const claimHandler = this.claimHandlersByAddress[claimHandlerHex];
                        if (claimHandler == null) {
                            throw new Error("getClaimResult(" + escrowHash + "): Unknown claim handler with claim: " + claimHandlerHex);
                        }
                        return claimHandler.parseWitnessResult(event.params.witness_result);
                    }
                };
            case ESCROW_STATE_REFUNDED:
                return {
                    type: await this.isExpired(signer, data) ? base_1.SwapCommitStateType.EXPIRED : base_1.SwapCommitStateType.NOT_COMMITED,
                    getTxBlock: async () => {
                        return {
                            blockTime: await this.Chain.Blocks.getBlockTime(blockHeight),
                            blockHeight: blockHeight
                        };
                    },
                    getRefundTxId: async () => {
                        const events = await this.Events.getContractBlockEvents(["escrow_manager::events::Refund"], [null, null, null, "0x" + escrowHash], blockHeight, blockHeight);
                        if (events.length === 0)
                            throw new Error("Refund event not found!");
                        return events[0].txHash;
                    }
                };
            default:
                return {
                    type: await this.isExpired(signer, data) ? base_1.SwapCommitStateType.EXPIRED : base_1.SwapCommitStateType.NOT_COMMITED
                };
        }
    }
    /**
     * @inheritDoc
     */
    async getCommitStatuses(request) {
        const result = {};
        let promises = [];
        //TODO: We can upgrade this to use multicall
        for (let { signer, swapData } of request) {
            promises.push(this.getCommitStatus(signer, swapData).then(val => {
                result[swapData.getEscrowHash()] = val;
            }));
            if (promises.length >= this.Chain.config.maxParallelCalls) {
                await Promise.all(promises);
                promises = [];
            }
        }
        await Promise.all(promises);
        return result;
    }
    ////////////////////////////////////////////
    //// Swap data initializer
    /**
     * @inheritDoc
     */
    createSwapData(type, offerer, claimer, token, amount, claimData, sequence, expiry, payIn, payOut, securityDeposit, claimerBounty, depositToken = this.Chain.Tokens.getNativeCurrencyAddress()) {
        const claimHandler = this.claimHandlersBySwapType[type];
        if (claimHandler == null)
            throw new Error("Invalid claim handler for type: " + base_1.ChainSwapType[type]);
        return Promise.resolve(new StarknetSwapData_1.StarknetSwapData({
            offerer,
            claimer,
            token,
            refundHandler: this.timelockRefundHandler.address,
            claimHandler: claimHandler.address,
            payOut,
            payIn,
            reputation: payIn, //For now track reputation for all payIn swaps
            sequence,
            claimData: "0x" + claimData,
            refundData: (0, Utils_1.toHex)(expiry),
            amount,
            feeToken: depositToken,
            securityDeposit,
            claimerBounty,
            kind: type
        }));
    }
    ////////////////////////////////////////////
    //// Utils
    /**
     *
     * @param address
     * @param token
     * @private
     */
    getIntermediaryBalance(address, token) {
        return this.LpVault.getIntermediaryBalance(address, token);
    }
    /**
     * @inheritDoc
     */
    async getBalance(signer, tokenAddress, inContract) {
        if (inContract)
            return await this.getIntermediaryBalance(signer, tokenAddress);
        //TODO: For native token we should discount the cost of deploying an account if it is not deployed yet
        return await this.Chain.getBalance(signer, tokenAddress);
    }
    /**
     * @inheritDoc
     */
    getIntermediaryReputation(address, token) {
        return this.LpVault.getIntermediaryReputation(address, token);
    }
    ////////////////////////////////////////////
    //// Transaction initializers
    /**
     * @inheritDoc
     */
    async txsClaimWithSecret(signer, swapData, secret, checkExpiry, initAta, feeRate, skipAtaCheck) {
        return this.Claim.txsClaimWithSecret(typeof (signer) === "string" ? signer : signer.getAddress(), swapData, secret, checkExpiry, feeRate);
    }
    /**
     * @inheritDoc
     */
    async txsClaimWithTxData(signer, swapData, tx, requiredConfirmations, vout, commitedHeader, synchronizer, initAta, feeRate) {
        return this.Claim.txsClaimWithTxData(typeof (signer) === "string" ? signer : signer.getAddress(), swapData, tx, requiredConfirmations, vout, commitedHeader, synchronizer, feeRate);
    }
    /**
     * @inheritDoc
     */
    txsRefund(signer, swapData, check, initAta, feeRate) {
        return this.Refund.txsRefund(signer, swapData, check, feeRate);
    }
    /**
     * @inheritDoc
     */
    txsRefundWithAuthorization(signer, swapData, sig, check, initAta, feeRate) {
        return this.Refund.txsRefundWithAuthorization(signer, swapData, sig.timeout, sig.prefix, sig.signature, check, feeRate);
    }
    /**
     * @inheritDoc
     */
    txsInit(sender, swapData, sig, skipChecks, feeRate) {
        return this.Init.txsInit(sender, swapData, sig.timeout, sig.prefix, sig.signature, skipChecks, feeRate);
    }
    /**
     * @inheritDoc
     */
    txsWithdraw(signer, token, amount, feeRate) {
        return this.LpVault.txsWithdraw(signer, token, amount, feeRate);
    }
    /**
     * @inheritDoc
     */
    txsDeposit(signer, token, amount, feeRate) {
        return this.LpVault.txsDeposit(signer, token, amount, feeRate);
    }
    ////////////////////////////////////////////
    //// Executors
    /**
     * @inheritDoc
     */
    async claimWithSecret(signer, swapData, secret, checkExpiry, initAta, txOptions) {
        const result = await this.Claim.txsClaimWithSecret(signer.getAddress(), swapData, secret, checkExpiry, txOptions?.feeRate);
        const [signature] = await this.Chain.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return signature;
    }
    /**
     * @inheritDoc
     */
    async claimWithTxData(signer, swapData, tx, requiredConfirmations, vout, commitedHeader, synchronizer, initAta, txOptions) {
        const txs = await this.Claim.txsClaimWithTxData(signer.getAddress(), swapData, tx, requiredConfirmations, vout, commitedHeader, synchronizer, txOptions?.feeRate);
        if (txs === null)
            throw new Error("Btc relay not synchronized to required blockheight!");
        //TODO: This doesn't return proper tx signature
        const [signature] = await this.Chain.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return signature;
    }
    /**
     * @inheritDoc
     */
    async refund(signer, swapData, check, initAta, txOptions) {
        let result = await this.txsRefund(signer.getAddress(), swapData, check, initAta, txOptions?.feeRate);
        const [signature] = await this.Chain.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return signature;
    }
    /**
     * @inheritDoc
     */
    async refundWithAuthorization(signer, swapData, signature, check, initAta, txOptions) {
        let result = await this.txsRefundWithAuthorization(signer.getAddress(), swapData, signature, check, initAta, txOptions?.feeRate);
        const [txSignature] = await this.Chain.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return txSignature;
    }
    /**
     * @inheritDoc
     */
    async init(signer, swapData, signature, skipChecks, txOptions) {
        if (swapData.isPayIn()) {
            if (!swapData.isOfferer(signer.getAddress()))
                throw new Error("Invalid signer provided!");
        }
        else {
            if (!swapData.isClaimer(signer.getAddress()))
                throw new Error("Invalid signer provided!");
        }
        let result = await this.txsInit(signer.getAddress(), swapData, signature, skipChecks, txOptions?.feeRate);
        const [txSignature] = await this.Chain.sendAndConfirm(signer, result, txOptions?.waitForConfirmation, txOptions?.abortSignal);
        return txSignature;
    }
    /**
     * @inheritDoc
     */
    async withdraw(signer, token, amount, txOptions) {
        const txs = await this.LpVault.txsWithdraw(signer.getAddress(), token, amount, txOptions?.feeRate);
        const [txId] = await this.Chain.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal, false);
        return txId;
    }
    /**
     * @inheritDoc
     */
    async deposit(signer, token, amount, txOptions) {
        const txs = await this.LpVault.txsDeposit(signer.getAddress(), token, amount, txOptions?.feeRate);
        const [txId] = await this.Chain.sendAndConfirm(signer, txs, txOptions?.waitForConfirmation, txOptions?.abortSignal, false);
        return txId;
    }
    ////////////////////////////////////////////
    //// Fees
    /**
     * @inheritDoc
     */
    getInitPayInFeeRate(offerer, claimer, token, paymentHash) {
        return this.Chain.Fees.getFeeRate();
    }
    /**
     * @inheritDoc
     */
    getInitFeeRate(offerer, claimer, token, paymentHash) {
        return this.Chain.Fees.getFeeRate();
    }
    /**
     * @inheritDoc
     */
    getRefundFeeRate(swapData) {
        return this.Chain.Fees.getFeeRate();
    }
    /**
     * @inheritDoc
     */
    getClaimFeeRate(signer, swapData) {
        return this.Chain.Fees.getFeeRate();
    }
    /**
     * @inheritDoc
     */
    getClaimFee(signer, swapData, feeRate) {
        return this.Claim.getClaimFee(swapData, feeRate);
    }
    /**
     * @inheritDoc
     */
    getCommitFee(signer, swapData, feeRate) {
        return this.Init.getInitFee(swapData, feeRate);
    }
    /**
     * @inheritDoc
     */
    getRefundFee(signer, swapData, feeRate) {
        return this.Refund.getRefundFee(swapData, feeRate);
    }
}
exports.StarknetSwapContract = StarknetSwapContract;
