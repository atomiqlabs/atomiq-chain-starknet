import {constants, Provider, RpcProvider} from "starknet";
import {StarknetFees} from "./base/modules/StarknetFees";
import {StarknetRetryPolicy} from "./base/StarknetBase";
import {StarknetBtcRelay} from "./btcrelay/StarknetBtcRelay";
import {StarknetSwapContract} from "./swaps/StarknetSwapContract";
import {StarknetChainEventsBrowser} from "./events/StarknetChainEventsBrowser";
import {StarknetSwapData} from "./swaps/StarknetSwapData";
import {BaseTokenType, BitcoinNetwork, BitcoinRpc, ChainData, ChainType} from "@atomiqlabs/base";
import {StarknetChainType} from "./StarknetChainType";

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

export const createStarknet:
    (options: StarknetOptions, bitcoinRpc: BitcoinRpc<any>, network: BitcoinNetwork) => ChainData<StarknetChainType, StarknetAssetsType>
    = ((options: StarknetOptions, bitcoinRpc: BitcoinRpc<any>, network: BitcoinNetwork) => {
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
        swapDataConstructor: StarknetSwapData,
        tokens: StarknetAssets
    }
});

type ChainOptions<C extends ChainType, O> = {[K in C["ChainId"]]: O};
type TokensDict<C extends ChainType, T extends BaseTokenType> = {[K in C["ChainId"]]: T};

const tokensDict: ChainOptions<StarknetChainType, StarknetOptions> = null;

type InitializerFn<O, C extends ChainType, T extends BaseTokenType> = (options: O, bitcoinRpc: BitcoinRpc<any>, network: BitcoinNetwork) => ChainData<C, T>;

function wrap<T extends InitializerFn<any, any, any>[]>(val: T, options: {}) {

}
