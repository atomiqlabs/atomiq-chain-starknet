import {BtcHeader} from "@atomiqlabs/base";
import {Buffer} from "buffer";
import {BigNumberish} from "starknet";
import {toHex, u32ArrayToBuffer, u32ReverseEndianness} from "../../../utils/Utils";
import {sha256} from "@noble/hashes/sha2";

export type StarknetBtcHeaderType = {
    reversed_version: BigNumberish;
    previous_blockhash: BigNumberish[];
    merkle_root: BigNumberish[];
    reversed_timestamp: BigNumberish;
    nbits: BigNumberish;
    nonce: BigNumberish;
    hash?: Buffer
}

/**
 * Representing a new bitcoin blockheader struct to be submitted to the Starknet BTC relay smart contract
 *
 * @category BTC Relay
 */
export class StarknetBtcHeader implements BtcHeader {

    reversed_version: number;
    previous_blockhash: number[];
    merkle_root: number[];
    reversed_timestamp: number;
    nbits: number;
    nonce: number;
    hash?: Buffer;

    /**
     * Constructs the bitcoin blockheader from a struct as returned by the starknet.js lib
     *
     * @param obj Struct as returned by the starknet.js lib
     */
    constructor(obj: StarknetBtcHeaderType) {
        this.reversed_version = Number(obj.reversed_version);
        this.previous_blockhash = obj.previous_blockhash.map(val => Number(val));
        this.merkle_root = obj.merkle_root.map(val => Number(val));
        this.reversed_timestamp = Number(obj.reversed_timestamp);
        this.nbits = Number(obj.nbits);
        this.nonce = Number(obj.nonce);
        this.hash = obj.hash;
    }

    /**
     * @inheritDoc
     */
    getMerkleRoot(): Buffer {
        return u32ArrayToBuffer(this.merkle_root);
    }

    /**
     * @inheritDoc
     */
    getNbits(): number {
        return u32ReverseEndianness(this.nbits);
    }

    /**
     * @inheritDoc
     */
    getNonce(): number {
        return u32ReverseEndianness(this.nonce);
    }

    /**
     * @inheritDoc
     */
    getReversedPrevBlockhash(): Buffer {
        return u32ArrayToBuffer(this.previous_blockhash);
    }

    /**
     * @inheritDoc
     */
    getTimestamp(): number {
        return u32ReverseEndianness(this.reversed_timestamp);
    }

    /**
     * @inheritDoc
     */
    getVersion(): number {
        return u32ReverseEndianness(this.reversed_version);
    }

    /**
     * @inheritDoc
     */
    getHash(): Buffer {
        if(this.hash!=null) return this.hash;
        const buffer = Buffer.alloc(80);
        buffer.writeUInt32BE(this.reversed_version, 0);
        u32ArrayToBuffer(this.previous_blockhash).copy(buffer, 4);
        u32ArrayToBuffer(this.merkle_root).copy(buffer, 36);
        buffer.writeUInt32BE(this.reversed_timestamp, 68);
        buffer.writeUInt32BE(this.nbits, 72);
        buffer.writeUInt32BE(this.nonce, 76);
        return Buffer.from(sha256(sha256(buffer)));
    }

    /**
     * Serializes the bitcoin blockheader struct to an array of felt252 of length 20
     */
    serialize(): BigNumberish[] {
        return [
            this.reversed_version,
            ...this.previous_blockhash,
            ...this.merkle_root,
            this.reversed_timestamp,
            this.nbits,
            this.nonce
        ];
    }

    /**
     * Deserializes the store bitcoin blockheader from its felt252 array representation
     *
     * @param span felt252 array encoding the stored blockheader, has to be at least 20 felts long
     */
    static fromSerializedFeltArray(span: BigNumberish[]): StarknetBtcHeader {
        if(span.length<20) throw new Error("Invalid serialized data size!");
        const reversed_version = toHex(span.shift()!);
        const previous_blockhash = span.splice(0, 8).map(val => toHex(val));
        const merkle_root = span.splice(0, 8).map(val => toHex(val));
        const reversed_timestamp = toHex(span.shift()!);
        const nbits = toHex(span.shift()!);
        const nonce = toHex(span.shift()!);
        return new StarknetBtcHeader({
            reversed_version,
            previous_blockhash,
            merkle_root,
            reversed_timestamp,
            nbits,
            nonce
        });
    }

}