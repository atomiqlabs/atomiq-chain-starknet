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
const Utils_1 = require("./utils/Utils");
const buffer_1 = require("buffer");
const StarknetBtcHeader_1 = require("./starknet/btcrelay/headers/StarknetBtcHeader");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const blockheader = new StarknetBtcHeader_1.StarknetBtcHeader({
            reversed_version: (0, Utils_1.u32ReverseEndianness)(e.getVersion()),
            previous_blockhash: (0, Utils_1.bufferToU32Array)(buffer_1.Buffer.from(e.getPrevBlockhash(), "hex").reverse()),
            merkle_root: (0, Utils_1.bufferToU32Array)(buffer_1.Buffer.from(e.getMerkleRoot(), "hex").reverse()),
            reversed_timestamp: (0, Utils_1.u32ReverseEndianness)(e.getTimestamp()),
            nbits: (0, Utils_1.u32ReverseEndianness)(e.getNbits()),
            nonce: (0, Utils_1.u32ReverseEndianness)(e.getNonce()),
            hash: buffer_1.Buffer.from(e.getHash(), "hex").reverse()
        });
    });
}
main();
