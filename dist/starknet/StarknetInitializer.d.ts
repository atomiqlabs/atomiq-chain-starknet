import { constants, Provider } from "starknet";
import { StarknetFees } from "./chain/modules/StarknetFees";
import { StarknetRetryPolicy } from "./chain/StarknetChainInterface";
import { BaseTokenType, BitcoinNetwork, BitcoinRpc, ChainData, ChainInitializer } from "@atomiqlabs/base";
import { StarknetChainType } from "./StarknetChainType";
export type StarknetAssetsType = BaseTokenType<"ETH" | "STRK" | "WBTC">;
export declare const StarknetAssets: StarknetAssetsType;
export type StarknetOptions = {
    rpcUrl: string | Provider;
    retryPolicy?: StarknetRetryPolicy;
    chainId?: constants.StarknetChainId;
    swapContract?: string;
    btcRelayContract?: string;
    fees?: StarknetFees;
};
export declare function initializeStarknet(options: StarknetOptions, bitcoinRpc: BitcoinRpc<any>, network: BitcoinNetwork): ChainData<StarknetChainType>;
export type StarknetInitializerType = ChainInitializer<StarknetOptions, StarknetChainType, StarknetAssetsType>;
export declare const StarknetInitializer: StarknetInitializerType;
