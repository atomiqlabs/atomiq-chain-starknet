"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitcoinOutputClaimHandler = void 0;
const base_1 = require("@atomiqlabs/base");
const starknet_1 = require("starknet");
const Utils_1 = require("../../../../../utils/Utils");
const IBitcoinClaimHandler_1 = require("./IBitcoinClaimHandler");
const btc_signer_1 = require("@scure/btc-signer");
const buffer_1 = require("buffer");
const StarknetFees_1 = require("../../../../chain/modules/StarknetFees");
const logger = (0, Utils_1.getLogger)("BitcoinOutputClaimHandler: ");
class BitcoinOutputClaimHandler extends IBitcoinClaimHandler_1.IBitcoinClaimHandler {
    serializeCommitment(data) {
        return [
            starknet_1.hash.computePoseidonHashOnElements([(0, Utils_1.toBigInt)(data.amount), (0, Utils_1.poseidonHashRange)(data.output)]),
            ...super.serializeCommitment(data)
        ];
    }
    async getWitness(signer, swapData, witnessData, feeRate) {
        if (!swapData.isClaimHandler(this.address))
            throw new Error("Invalid claim handler");
        const parsedBtcTx = btc_signer_1.Transaction.fromRaw(buffer_1.Buffer.from(witnessData.tx.hex, "hex"));
        const out = parsedBtcTx.getOutput(witnessData.vout);
        const { initialTxns, witness } = await this._getWitness(signer, swapData, witnessData, {
            output: buffer_1.Buffer.from(out.script),
            amount: out.amount
        });
        witness.push(...(0, Utils_1.bufferToByteArray)(buffer_1.Buffer.from(witnessData.tx.hex, "hex")));
        witness.push(BigInt(witnessData.vout));
        return { initialTxns, witness };
    }
    getGas(data, witnessData) {
        return StarknetFees_1.StarknetFees.starknetGasAdd(BitcoinOutputClaimHandler.gas, StarknetFees_1.StarknetFees.starknetGasMul(BitcoinOutputClaimHandler.gasPerTxByte, witnessData != null ? witnessData.tx.hex.length / 2 : 3000));
    }
    getType() {
        return BitcoinOutputClaimHandler.type;
    }
}
exports.BitcoinOutputClaimHandler = BitcoinOutputClaimHandler;
BitcoinOutputClaimHandler.type = base_1.ChainSwapType.CHAIN;
BitcoinOutputClaimHandler.gas = { l1DataGas: 0, l2Gas: 100000000, l1Gas: 0 };
BitcoinOutputClaimHandler.gasPerTxByte = { l1DataGas: 0, l2Gas: 100000, l1Gas: 0 };
