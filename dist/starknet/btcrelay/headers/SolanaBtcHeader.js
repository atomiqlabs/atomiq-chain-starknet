"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetBtcHeader = void 0;
const Utils_1 = require("../../../utils/Utils");
class StarknetBtcHeader {
    constructor(obj) {
        this.reversed_version = Number(obj.reversed_version);
        this.previous_blockhash = obj.previous_blockhash.map(val => Number(val));
        this.merkle_root = obj.merkle_root.map(val => Number(val));
        this.reversed_timestamp = Number(obj.reversed_timestamp);
        this.nbits = Number(obj.nbits);
        this.nonce = Number(obj.nonce);
        this.hash = obj.hash;
    }
    getMerkleRoot() {
        return (0, Utils_1.u32ArrayToBuffer)(this.merkle_root);
    }
    getNbits() {
        return (0, Utils_1.u32ReverseEndianness)(this.nbits);
    }
    getNonce() {
        return (0, Utils_1.u32ReverseEndianness)(this.nonce);
    }
    getReversedPrevBlockhash() {
        return (0, Utils_1.u32ArrayToBuffer)(this.previous_blockhash);
    }
    getTimestamp() {
        return (0, Utils_1.u32ReverseEndianness)(this.reversed_timestamp);
    }
    getVersion() {
        return (0, Utils_1.u32ReverseEndianness)(this.reversed_version);
    }
}
exports.StarknetBtcHeader = StarknetBtcHeader;
