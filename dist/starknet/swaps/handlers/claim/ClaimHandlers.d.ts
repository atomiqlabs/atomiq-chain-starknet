import { ChainSwapType } from "@atomiqlabs/base";
import { StarknetGas } from "../../../base/StarknetAction";
import { IHandler } from "../IHandler";
import { BigNumberish } from "starknet";
export interface IClaimHandler<C, W> extends IHandler<C, W> {
    getType(): ChainSwapType;
    parseWitnessResult(result: BigNumberish[]): string;
}
export type ClaimHandlerType = {
    gas: StarknetGas;
    address: string;
    type: ChainSwapType;
} & (new () => IClaimHandler<any, any>);
export declare const claimHandlersList: ClaimHandlerType[];
export declare const claimHandlersByAddress: {
    [address: string]: ClaimHandlerType;
};
export declare const claimHandlersBySwapType: {
    [swapType in ChainSwapType]?: ClaimHandlerType;
};
