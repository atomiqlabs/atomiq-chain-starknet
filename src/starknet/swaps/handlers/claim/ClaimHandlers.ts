import {HashlockClaimHandler} from "./HashlockClaimHandler";
import {ChainSwapType} from "@atomiqlabs/base";
import {StarknetGas} from "../../../base/StarknetAction";
import {IHandler} from "../IHandler";
import {BitcoinTxIdClaimHandler} from "./btc/BitcoinTxIdClaimHandler";
import {BitcoinOutputClaimHandler} from "./btc/BitcoinOutputClaimHandler";
import {BitcoinNoncedOutputClaimHandler} from "./btc/BitcoinNoncedOutputClaimHandler";
import {BigNumberish} from "starknet";

export interface IClaimHandler<C, W> extends IHandler<C, W> {
    getType(): ChainSwapType;
    parseWitnessResult(result: BigNumberish[]): string;
}

export type ClaimHandlerType = {gas: StarknetGas, address: string, type: ChainSwapType} & (new () => IClaimHandler<any, any>);

export const claimHandlersList: ClaimHandlerType[] = [
    HashlockClaimHandler,
    BitcoinTxIdClaimHandler,
    BitcoinOutputClaimHandler,
    BitcoinNoncedOutputClaimHandler
];

export const claimHandlersByAddress: {[address: string]: ClaimHandlerType} = {};

export const claimHandlersBySwapType: {[swapType in ChainSwapType]?: ClaimHandlerType} = {}

claimHandlersList.forEach(val => {
    claimHandlersByAddress[val.address.toLowerCase()] = val;
    claimHandlersBySwapType[val.type] = val;
})
