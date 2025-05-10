import {constants, Provider} from "starknet";
import {StarknetFees} from "./chain/modules/StarknetFees";
import {StarknetChainInterface, StarknetRetryPolicy} from "./chain/StarknetChainInterface";
import {StarknetBtcRelay} from "./btcrelay/StarknetBtcRelay";
import {StarknetSwapContract} from "./swaps/StarknetSwapContract";
import {StarknetChainEventsBrowser} from "./events/StarknetChainEventsBrowser";
import {BaseTokenType, BitcoinNetwork, BitcoinRpc, ChainData, ChainInitializer} from "@atomiqlabs/base";
import {StarknetChainType} from "./StarknetChainType";
import {StarknetSwapData} from "./swaps/StarknetSwapData";
import {StarknetSpvVaultContract} from "./spv_swap/StarknetSpvVaultContract";
import {StarknetSpvVaultData} from "./spv_swap/StarknetSpvVaultData";
import {StarknetSpvWithdrawalData} from "./spv_swap/StarknetSpvWithdrawalData";
import {RpcProviderWithRetries} from "./provider/RpcProviderWithRetries";

export type StarknetAssetsType = BaseTokenType<"ETH" | "STRK" | "WBTC">;
export const StarknetAssets: StarknetAssetsType = {
    ETH: {
        address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
        decimals: 18,
        displayDecimals: 9
    },
    STRK: {
        address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
        decimals: 18,
        displayDecimals: 9
    },
    WBTC: {
        address: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
        decimals: 8
    }
} as const;

export type StarknetOptions = {
    rpcUrl: string | Provider,
    retryPolicy?: StarknetRetryPolicy,
    chainId?: constants.StarknetChainId,

    swapContract?: string,
    btcRelayContract?: string,
    spvVaultContract?: string,

    fees?: StarknetFees
}

export function initializeStarknet(
    options: StarknetOptions,
    bitcoinRpc: BitcoinRpc<any>,
    network: BitcoinNetwork
): ChainData<StarknetChainType> {
    const provider = typeof(options.rpcUrl)==="string" ?
        new RpcProviderWithRetries({nodeUrl: options.rpcUrl}) :
        options.rpcUrl;

    const Fees = options.fees ?? new StarknetFees(provider, "ETH");

    const chainId = options.chainId ??
        (network===BitcoinNetwork.MAINNET ? constants.StarknetChainId.SN_MAIN : constants.StarknetChainId.SN_SEPOLIA);

    const chainInterface = new StarknetChainInterface(chainId, provider, options.retryPolicy, Fees);

    const btcRelay = new StarknetBtcRelay(
        chainInterface, bitcoinRpc, network, options.btcRelayContract
    );

    const swapContract = new StarknetSwapContract(
        chainInterface, btcRelay, options.swapContract
    );

    const spvVaultContract = new StarknetSpvVaultContract(
        chainInterface, btcRelay, bitcoinRpc, options.spvVaultContract
    )

    const chainEvents = new StarknetChainEventsBrowser(chainInterface, swapContract, spvVaultContract);

    return {
        chainId: "STARKNET",
        btcRelay,
        chainInterface,
        swapContract,
        chainEvents,
        swapDataConstructor: StarknetSwapData,
        spvVaultContract,
        spvVaultDataConstructor: StarknetSpvVaultData,
        spvVaultWithdrawalDataConstructor: StarknetSpvWithdrawalData
    }
};

export type StarknetInitializerType = ChainInitializer<StarknetOptions, StarknetChainType, StarknetAssetsType>;
export const StarknetInitializer: StarknetInitializerType = {
    chainId: "STARKNET",
    chainType: null as StarknetChainType,
    initializer: initializeStarknet,
    tokens: StarknetAssets,
    options: null as StarknetOptions
} as const;
