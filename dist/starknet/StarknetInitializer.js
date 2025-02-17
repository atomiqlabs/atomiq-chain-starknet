"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetInitializer = exports.initializeStarknet = exports.StarknetAssets = void 0;
const starknet_1 = require("starknet");
const StarknetFees_1 = require("./base/modules/StarknetFees");
const StarknetBtcRelay_1 = require("./btcrelay/StarknetBtcRelay");
const StarknetSwapContract_1 = require("./swaps/StarknetSwapContract");
const StarknetChainEventsBrowser_1 = require("./events/StarknetChainEventsBrowser");
const base_1 = require("@atomiqlabs/base");
const StarknetSwapData_1 = require("./swaps/StarknetSwapData");
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
    }
};
function initializeStarknet(options, bitcoinRpc, network) {
    var _a, _b;
    const provider = typeof (options.rpcUrl) === "string" ?
        new starknet_1.RpcProvider({ nodeUrl: options.rpcUrl }) :
        options.rpcUrl;
    const Fees = (_a = options.fees) !== null && _a !== void 0 ? _a : new StarknetFees_1.StarknetFees(provider, "ETH");
    const chainId = (_b = options.chainId) !== null && _b !== void 0 ? _b : (network === base_1.BitcoinNetwork.MAINNET ? starknet_1.constants.StarknetChainId.SN_MAIN : starknet_1.constants.StarknetChainId.SN_SEPOLIA);
    const btcRelay = new StarknetBtcRelay_1.StarknetBtcRelay(chainId, provider, bitcoinRpc, options.btcRelayContract, options.retryPolicy, Fees);
    const swapContract = new StarknetSwapContract_1.StarknetSwapContract(chainId, provider, btcRelay, options.swapContract, options.retryPolicy, Fees);
    const chainEvents = new StarknetChainEventsBrowser_1.StarknetChainEventsBrowser(swapContract);
    return {
        chainId: "STARKNET",
        btcRelay,
        swapContract,
        chainEvents,
        swapDataConstructor: StarknetSwapData_1.StarknetSwapData
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
