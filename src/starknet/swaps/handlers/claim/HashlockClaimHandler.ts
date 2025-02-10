import {StarknetSwapData} from "../../StarknetSwapData";
import {bufferToU32Array, toHex, u32ArrayToBuffer} from "../../../../utils/Utils";
import {BigNumberish, hash} from "starknet";
import {IHandler} from "../IHandler";
import {ChainSwapType} from "@atomiqlabs/base";
import {StarknetGas} from "../../../base/StarknetAction";
import {Buffer} from "buffer";
import * as createHash from "create-hash";
import {StarknetTx} from "../../../base/modules/StarknetTransactions";

export class HashlockClaimHandler implements IHandler<Buffer, string> {

    public static readonly address = "";
    public static readonly type: ChainSwapType = ChainSwapType.HTLC;
    public static readonly gas: StarknetGas = {l1: 750};

    getCommitment(data: Buffer): BigNumberish {
        if(data.length!==32) throw new Error("Invalid swap hash");
        return hash.computePoseidonHashOnElements(bufferToU32Array(data));
    }

    public getWitness(signer: string, data: StarknetSwapData, witnessData: string): Promise<{
        initialTxns: StarknetTx[],
        witness: BigNumberish[]
    }> {
        if(!data.isClaimHandler(HashlockClaimHandler.address)) throw new Error("Invalid claim handler");
        if(witnessData.length!==64) throw new Error("Invalid hash secret: string length");
        const buffer = Buffer.from(witnessData, "hex");
        if(buffer.length!==32) throw new Error("Invalid hash secret: buff length");

        const witnessSha256 = createHash("sha256").update(buffer).digest()
        if(!data.isClaimData(toHex(this.getCommitment(witnessSha256)))) throw new Error("Invalid hash secret: poseidon hash doesn't match");

        const witnessArray = bufferToU32Array(buffer);
        return Promise.resolve({initialTxns: [], witness: witnessArray});
    }

    getGas(): StarknetGas {
        return HashlockClaimHandler.gas;
    }

    getType(): ChainSwapType {
        return HashlockClaimHandler.type;
    }

    parseWitnessResult(result: BigNumberish[]): string {
        return u32ArrayToBuffer(result).toString("hex");
    }

}