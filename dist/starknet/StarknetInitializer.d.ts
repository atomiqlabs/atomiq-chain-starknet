import { constants, Provider } from "starknet";
import { StarknetFees } from "./base/modules/StarknetFees";
import { StarknetRetryPolicy } from "./base/StarknetBase";
import { BitcoinNetwork, BitcoinRpc, ChainData } from "@atomiqlabs/base";
import { StarknetChainType } from "./StarknetChainType";
export declare const StarknetAssets: {
    readonly ETH: {
        readonly address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
        readonly decimals: 18;
        readonly displayDecimals: 9;
    };
    readonly STRK: {
        readonly address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
        readonly decimals: 18;
        readonly displayDecimals: 9;
    };
};
export type StarknetAssetsType = typeof StarknetAssets;
export type StarknetOptions = {
    rpcUrl: string | Provider;
    retryPolicy?: StarknetRetryPolicy;
    chainId?: constants.StarknetChainId;
    swapContract?: string;
    btcRelayContract?: string;
    fees?: StarknetFees;
};
export declare function initializeStarknet(options: StarknetOptions, bitcoinRpc: BitcoinRpc<any>, network: BitcoinNetwork): ChainData<StarknetChainType>;
export declare const StarknetInitializer: {
    readonly chainId: "STARKNET";
    readonly chainType: StarknetChainType;
    readonly initializer: typeof initializeStarknet;
    readonly tokens: {
        readonly ETH: {
            readonly address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
            readonly decimals: 18;
            readonly displayDecimals: 9;
        };
        readonly STRK: {
            readonly address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
            readonly decimals: 18;
            readonly displayDecimals: 9;
        };
    };
    readonly options: StarknetOptions;
};
export type StarknetInitializerType = typeof StarknetInitializer;
