"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetInitializer = exports.initializeStarknet = exports.StarknetAssets = void 0;
const starknet_1 = require("starknet");
const StarknetFees_1 = require("./chain/modules/StarknetFees");
const StarknetChainInterface_1 = require("./chain/StarknetChainInterface");
const StarknetBtcRelay_1 = require("./btcrelay/StarknetBtcRelay");
const StarknetSwapContract_1 = require("./swaps/StarknetSwapContract");
const StarknetChainEventsBrowser_1 = require("./events/StarknetChainEventsBrowser");
const base_1 = require("@atomiqlabs/base");
const StarknetSwapData_1 = require("./swaps/StarknetSwapData");
const StarknetSpvVaultContract_1 = require("./spv_swap/StarknetSpvVaultContract");
const StarknetSpvVaultData_1 = require("./spv_swap/StarknetSpvVaultData");
const StarknetSpvWithdrawalData_1 = require("./spv_swap/StarknetSpvWithdrawalData");
const RpcProviderWithRetries_1 = require("./provider/RpcProviderWithRetries");
exports.StarknetAssets = {
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
};
function initializeStarknet(options, bitcoinRpc, network) {
    const provider = typeof (options.rpcUrl) === "string" ?
        new RpcProviderWithRetries_1.RpcProviderWithRetries({ nodeUrl: options.rpcUrl }) :
        options.rpcUrl;
    const Fees = options.fees ?? new StarknetFees_1.StarknetFees(provider, "STRK");
    const chainId = options.chainId ??
        (network === base_1.BitcoinNetwork.MAINNET ? starknet_1.constants.StarknetChainId.SN_MAIN : starknet_1.constants.StarknetChainId.SN_SEPOLIA);
    const chainInterface = new StarknetChainInterface_1.StarknetChainInterface(chainId, provider, options.retryPolicy, Fees);
    const btcRelay = new StarknetBtcRelay_1.StarknetBtcRelay(chainInterface, bitcoinRpc, network, options.btcRelayContract);
    const swapContract = new StarknetSwapContract_1.StarknetSwapContract(chainInterface, btcRelay, options.swapContract);
    const spvVaultContract = new StarknetSpvVaultContract_1.StarknetSpvVaultContract(chainInterface, btcRelay, bitcoinRpc, options.spvVaultContract);
    const chainEvents = new StarknetChainEventsBrowser_1.StarknetChainEventsBrowser(chainInterface, swapContract, spvVaultContract);
    return {
        chainId: "STARKNET",
        btcRelay,
        chainInterface,
        swapContract,
        chainEvents,
        swapDataConstructor: StarknetSwapData_1.StarknetSwapData,
        spvVaultContract,
        spvVaultDataConstructor: StarknetSpvVaultData_1.StarknetSpvVaultData,
        spvVaultWithdrawalDataConstructor: StarknetSpvWithdrawalData_1.StarknetSpvWithdrawalData
    };
}
exports.initializeStarknet = initializeStarknet;
;
exports.StarknetInitializer = {
    chainId: "STARKNET",
    chainType: null,
    initializer: initializeStarknet,
    tokens: exports.StarknetAssets,
    options: null
};
