"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetSwapData = exports.StarknetSpvVaultData = exports.StarknetAction = exports.StarknetBtcHeader = exports.StarknetBtcStoredHeader = void 0;
/**
 * # @atomiqlabs/chain-starknet
 *
 * `@atomiqlabs/chain-starknet` is the Starknet integration package for the Atomiq protocol.
 *
 * Within the Atomiq stack, this library provides the Starknet-side building blocks used for Bitcoin-aware swaps and SPV-backed vault flows on Starknet. It includes:
 *
 * - the `StarknetInitializer` used to register Starknet support in the Atomiq SDK
 * - the `StarknetChainInterface` used to talk to Starknet RPCs
 * - Starknet BTC relay, escrow swap, and SPV vault contract wrappers
 * - signer helpers for browser and programmatic Starknet integrations
 * - retrying RPC and websocket helpers for chain access and realtime events
 *
 * This package is intended for direct protocol integrations and for higher-level Atomiq SDK layers that need Starknet chain support.
 *
 * ## Installation
 *
 * Install the package with its `starknet` peer dependency:
 *
 * ```bash
 * npm install @atomiqlabs/chain-starknet starknet
 * ```
 *
 * ## Supported Chains
 *
 * This package exports a single Starknet initializer:
 *
 * - Starknet via `StarknetInitializer`
 *
 * Canonical deployments currently defined in this package:
 *
 * | Chain | Canonical deployments included |
 * |-------|--------------------------------|
 * | Starknet     | `MAINNET`, `TESTNET`, `TESTNET4`      |
 *
 * By default, `StarknetInitializer` selects `SN_MAIN` Starknet network when `bitcoinNetwork` is `BitcoinNetwork.MAINNET`, and `SN_SEPOLIA` otherwise. That means both `BitcoinNetwork.TESTNET` and `BitcoinNetwork.TESTNET4` use Starknet Sepolia by default, while the BTC relay contract switches to the matching Bitcoin-network-specific deployment.
 *
 * If you need a non-canonical deployment, pass explicit, `swapContract`, `spvVaultContract`, `btcRelayContract`, or handler contract overrides in the initializer options.
 *
 * ## SDK Example
 *
 * Initialize the Atomiq SDK with Starknet network support:
 *
 * ```ts
 * import {StarknetInitializer} from "@atomiqlabs/chain-starknet";
 * import {BitcoinNetwork, SwapperFactory, TypedSwapper} from "@atomiqlabs/sdk";
 *
 * // Define chains that you want to support here
 * const chains = [StarknetInitializer] as const;
 * type SupportedChains = typeof chains;
 *
 * const Factory = new SwapperFactory<SupportedChains>(chains);
 *
 * const swapper: TypedSwapper<SupportedChains> = Factory.newSwapper({
 *   chains: {
 *     STARKNET: {
 *       rpcUrl: starknetRpc,
 *       wsUrl: starknetWs // Optional, but recommended for realtime event subscriptions
 *     }
 *   },
 *   bitcoinNetwork: BitcoinNetwork.MAINNET // or BitcoinNetwork.TESTNET / BitcoinNetwork.TESTNET4
 * });
 * ```
 *
 * If you use the lower-level initializer directly, you can also override the default Starknet chain ID and canonical contract addresses independently when you need custom deployments.
 *
 * @packageDocumentation
 */
const WebSocket = require("ws");
if (global.window == null)
    global.WebSocket = WebSocket;
var StarknetBtcStoredHeader_1 = require("./starknet/btcrelay/headers/StarknetBtcStoredHeader");
Object.defineProperty(exports, "StarknetBtcStoredHeader", { enumerable: true, get: function () { return StarknetBtcStoredHeader_1.StarknetBtcStoredHeader; } });
var StarknetBtcHeader_1 = require("./starknet/btcrelay/headers/StarknetBtcHeader");
Object.defineProperty(exports, "StarknetBtcHeader", { enumerable: true, get: function () { return StarknetBtcHeader_1.StarknetBtcHeader; } });
__exportStar(require("./starknet/btcrelay/StarknetBtcRelay"), exports);
__exportStar(require("./starknet/chain/modules/StarknetFees"), exports);
var StarknetAction_1 = require("./starknet/chain/StarknetAction");
Object.defineProperty(exports, "StarknetAction", { enumerable: true, get: function () { return StarknetAction_1.StarknetAction; } });
__exportStar(require("./starknet/chain/StarknetChainInterface"), exports);
__exportStar(require("./starknet/events/StarknetChainEventsBrowser"), exports);
__exportStar(require("./starknet/provider/RpcProviderWithRetries"), exports);
__exportStar(require("./starknet/provider/WebSocketChannelWithRetries"), exports);
__exportStar(require("./starknet/spv_swap/StarknetSpvVaultContract"), exports);
var StarknetSpvVaultData_1 = require("./starknet/spv_swap/StarknetSpvVaultData");
Object.defineProperty(exports, "StarknetSpvVaultData", { enumerable: true, get: function () { return StarknetSpvVaultData_1.StarknetSpvVaultData; } });
__exportStar(require("./starknet/spv_swap/StarknetSpvWithdrawalData"), exports);
__exportStar(require("./starknet/swaps/StarknetSwapContract"), exports);
var StarknetSwapData_1 = require("./starknet/swaps/StarknetSwapData");
Object.defineProperty(exports, "StarknetSwapData", { enumerable: true, get: function () { return StarknetSwapData_1.StarknetSwapData; } });
__exportStar(require("./starknet/wallet/StarknetSigner"), exports);
__exportStar(require("./starknet/wallet/StarknetBrowserSigner"), exports);
__exportStar(require("./starknet/wallet/accounts/StarknetKeypairWallet"), exports);
__exportStar(require("./starknet/StarknetChainType"), exports);
__exportStar(require("./starknet/StarknetInitializer"), exports);
