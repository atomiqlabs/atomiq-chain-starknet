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
 * Configuration options for initializing Starknet chain
 *
 * @category Chain Interface
 */
export type StarknetOptions = {
    /**
     * Starknet RPC URL or {@link Provider} object to use for Starknet network access
     */
    rpcUrl: string | Provider;
    /**
     * Optional WebSocket URL or {@link WebSocketChannel} object to use for realtime events subscriptions
     */
    wsUrl?: string | WebSocketChannel;
    /**
     * Retry policy for the RPC calls
     */
    retryPolicy?: {
        maxRetries?: number;
        delay?: number;
        exponential?: boolean;
    };
    /**
     * Starknet chain ID: mainnet or sepolia
     */
    chainId?: constants.StarknetChainId;
    /**
     * Contract address of the Escrow Manager contract, uses canonical deployment by default
     */
    swapContract?: string;
    /**
     * Optional Escrow Manager contract deployment height, which acts as genesis when querying events
     */
    swapContractDeploymentHeight?: number;
    /**
     * Contract address of the BTC Relay contract, uses canonical deployment by default
     */
    btcRelayContract?: string;
    /**
     * Optional BTC Relay contract deployment height, which acts as genesis when querying events
     */
    btcRelayContractDeploymentHeight?: number;
    /**
     * Contract address of the UTXO-controlled vault (SPV Vault manager) contract, uses canonical deployment by default
     */
    spvVaultContract?: string;
    /**
     * Optional UTXO-controlled vault (SPV Vault manager) contract deployment height, which acts as genesis when querying events
     */
    spvVaultContractDeploymentHeight?: number;
    /**
     * Contract addresses of the refund and claim handlers, uses canonical deployment by default
     */
    handlerContracts?: {
        refund?: {
            timelock?: string;
        };
        claim?: {
            [type in ChainSwapType]?: string;
        };
    };
    /**
     * Starknet network fee API
     */
    fees?: StarknetFees;
    /**
     * Starknet configuration
     */
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
