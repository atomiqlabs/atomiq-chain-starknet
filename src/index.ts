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
import * as WebSocket from "ws";
if(global.window==null) global.WebSocket = WebSocket as any;

export {StarknetBtcStoredHeader} from "./starknet/btcrelay/headers/StarknetBtcStoredHeader";
export {StarknetBtcHeader} from "./starknet/btcrelay/headers/StarknetBtcHeader";
export * from "./starknet/btcrelay/StarknetBtcRelay";

export * from "./starknet/chain/modules/StarknetFees";
export {StarknetTx, SignedStarknetTx} from "./starknet/chain/modules/StarknetTransactions";
export {StarknetAction} from "./starknet/chain/StarknetAction";
export * from "./starknet/chain/StarknetChainInterface";

export * from "./starknet/events/StarknetChainEventsBrowser";

export * from "./starknet/provider/RpcProviderWithRetries";
export * from "./starknet/provider/WebSocketChannelWithRetries";

export * from "./starknet/spv_swap/StarknetSpvVaultContract";
export {StarknetSpvVaultData} from "./starknet/spv_swap/StarknetSpvVaultData";
export * from "./starknet/spv_swap/StarknetSpvWithdrawalData";

export * from "./starknet/swaps/StarknetSwapContract";
export {StarknetSuccessAction, StarknetSwapData} from "./starknet/swaps/StarknetSwapData";

export * from "./starknet/wallet/StarknetSigner";
export * from "./starknet/wallet/StarknetBrowserSigner";
export * from "./starknet/wallet/accounts/StarknetKeypairWallet";

export * from "./starknet/StarknetChainType";
export * from "./starknet/StarknetInitializer";