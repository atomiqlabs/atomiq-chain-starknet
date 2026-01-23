import { constants, Provider, WebSocketChannel } from "starknet";
import { StarknetFees } from "./chain/modules/StarknetFees";
import { StarknetConfig } from "./chain/StarknetChainInterface";
import { BaseTokenType, BitcoinNetwork, BitcoinRpc, ChainData, ChainInitializer, ChainSwapType } from "@atomiqlabs/base";
import { StarknetChainType } from "./StarknetChainType";
/**
 * Token assets available on Starknet
 *
 * @category Chain Interface
 */
export type StarknetAssetsType = BaseTokenType<"ETH" | "STRK" | "WBTC" | "TBTC" | "USDC" | "USDT" | "_TESTNET_WBTC_VESU">;
/**
 * Default Starknet token assets configuration
 *
 * @category Chain Interface
 */
export declare const StarknetAssets: StarknetAssetsType;
/**
 * Configuration options for initializing Starknet chain
 *
 * @category Chain Interface
 */
export type StarknetOptions = {
    rpcUrl: string | Provider;
    wsUrl?: string | WebSocketChannel;
    retryPolicy?: {
        maxRetries?: number;
        delay?: number;
        exponential?: boolean;
    };
    chainId?: constants.StarknetChainId;
    swapContract?: string;
    btcRelayContract?: string;
    spvVaultContract?: string;
    handlerContracts?: {
        refund?: {
            timelock?: string;
        };
        claim?: {
            [type in ChainSwapType]?: string;
        };
    };
    fees?: StarknetFees;
    starknetConfig?: StarknetConfig;
};
/**
 * Initialize Starknet chain integration
 *
 * @category Chain Interface
 */
export declare function initializeStarknet(options: StarknetOptions, bitcoinRpc: BitcoinRpc<any>, network: BitcoinNetwork): ChainData<StarknetChainType>;
/**
 * Type definition for the Starknet chain initializer
 *
 * @category Chain Interface
 */
export type StarknetInitializerType = ChainInitializer<StarknetOptions, StarknetChainType, StarknetAssetsType>;
/**
 * Starknet chain initializer instance
 *
 * @category Chain Interface
 */
export declare const StarknetInitializer: StarknetInitializerType;
