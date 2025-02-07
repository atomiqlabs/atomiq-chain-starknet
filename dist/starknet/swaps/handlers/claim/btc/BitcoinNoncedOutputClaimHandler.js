"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitcoinNoncedOutputClaimHandler = void 0;
const base_1 = require("@atomiqlabs/base");
const starknet_1 = require("starknet");
const Utils_1 = require("../../../../../utils/Utils");
const IBitcoinClaimHandler_1 = require("./IBitcoinClaimHandler");
const BN = require("bn.js");
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const logger = (0, Utils_1.getLogger)("BitcoinNoncedOutputClaimHandler: ");
function getTransactionNonce(btcTx) {
    const locktimeSub500M = new BN(btcTx.locktime - 500000000);
    if (locktimeSub500M.isNeg())
        throw new Error("Locktime too low!");
    const nSequence = new BN(btcTx.ins[0].sequence);
    return locktimeSub500M.shln(24).or(nSequence.and(new BN(0x00FFFFFF)));
}
class BitcoinNoncedOutputClaimHandler extends IBitcoinClaimHandler_1.IBitcoinClaimHandler {
    serializeCommitment(data) {
        return [
            starknet_1.hash.computePoseidonHashOnElements([(0, Utils_1.toBigInt)(data.nonce), (0, Utils_1.toBigInt)(data.amount), (0, Utils_1.poseidonHashRange)(data.output)]),
            ...super.serializeCommitment(data)
        ];
    }
    getWitness(signer, swapData, witnessData, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!swapData.isClaimHandler(BitcoinNoncedOutputClaimHandler.address))
                throw new Error("Invalid claim handler");
            const parsedBtcTx = bitcoinjs_lib_1.Transaction.fromHex(witnessData.tx.hex);
            const out = parsedBtcTx.outs[witnessData.vout];
            const { initialTxns, witness } = yield this._getWitness(signer, swapData, witnessData, {
                output: out.script,
                amount: new BN(out.value),
                nonce: getTransactionNonce(parsedBtcTx)
            });
            witness.push(...(0, Utils_1.bufferToByteArray)(Buffer.from(witnessData.tx.hex, "hex")));
            witness.push(BigInt(witnessData.vout));
            return { initialTxns, witness };
        });
    }
    getGas(data) {
        return BitcoinNoncedOutputClaimHandler.gas;
    }
    getType() {
        return BitcoinNoncedOutputClaimHandler.type;
    }
}
exports.BitcoinNoncedOutputClaimHandler = BitcoinNoncedOutputClaimHandler;
BitcoinNoncedOutputClaimHandler.address = "";
BitcoinNoncedOutputClaimHandler.type = base_1.ChainSwapType.CHAIN_NONCED;
BitcoinNoncedOutputClaimHandler.gas = { l1: 20000 };
