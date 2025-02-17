import {constants, Provider, RpcProvider} from "starknet";
import {StarknetFees} from "./base/modules/StarknetFees";
import {StarknetRetryPolicy} from "./base/StarknetBase";
import {StarknetBtcRelay} from "./btcrelay/StarknetBtcRelay";
import {StarknetSwapContract} from "./swaps/StarknetSwapContract";
import {StarknetChainEventsBrowser} from "./events/StarknetChainEventsBrowser";
import {BitcoinNetwork, BitcoinRpc, ChainData} from "@atomiqlabs/base";
import {StarknetChainType} from "./StarknetChainType";
import {StarknetSwapData} from "./swaps/StarknetSwapData";

export const StarknetAssets = {
    ETH: {
        address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
        decimals: 18,
        displayDecimals: 9
    },
    STRK: {
        address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
        decimals: 18,
        displayDecimals: 9
    }
} as const;
export type StarknetAssetsType = typeof StarknetAssets;

export type StarknetOptions = {
    rpcUrl: string | Provider,
    retryPolicy?: StarknetRetryPolicy,
    chainId?: constants.StarknetChainId,

    swapContract?: string,
    btcRelayContract?: string,

    fees?: StarknetFees
}

export function initializeStarknet(
    options: StarknetOptions,
    bitcoinRpc: BitcoinRpc<any>,
    network: BitcoinNetwork
): ChainData<StarknetChainType> {
    const provider = typeof(options.rpcUrl)==="string" ?
        new RpcProvider({nodeUrl: options.rpcUrl}) :
        options.rpcUrl;

    const Fees = options.fees ?? new StarknetFees(provider, "ETH");

    const chainId = options.chainId ??
        (network===BitcoinNetwork.MAINNET ? constants.StarknetChainId.SN_MAIN : constants.StarknetChainId.SN_SEPOLIA);

    const btcRelay = new StarknetBtcRelay(
        chainId, provider, bitcoinRpc, options.btcRelayContract, options.retryPolicy, Fees
    );

    const swapContract = new StarknetSwapContract(
        chainId, provider, btcRelay, options.swapContract, options.retryPolicy, Fees
    );
    const chainEvents = new StarknetChainEventsBrowser(swapContract);

    return {
        chainId: "STARKNET",
        btcRelay,
        swapContract,
        chainEvents,
        swapDataConstructor: StarknetSwapData
    }
};

export const StarknetInitializer = {
    chainId: "STARKNET",
    chainType: null as StarknetChainType,
    initializer: initializeStarknet,
    tokens: StarknetAssets,
    options: null as StarknetOptions
} as const;

export type StarknetInitializerType = typeof StarknetInitializer;
