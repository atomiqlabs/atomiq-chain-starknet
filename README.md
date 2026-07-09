# @atomiqlabs/chain-starknet

`@atomiqlabs/chain-starknet` is the Starknet integration package for the Atomiq protocol.

Within the Atomiq stack, this library provides the Starknet-side building blocks used for Bitcoin-aware swaps and SPV-backed vault flows on Starknet. It includes:

- the `StarknetInitializer` used to register Starknet support in the Atomiq SDK
- the `StarknetChainInterface` used to talk to Starknet RPCs
- Starknet BTC relay, escrow swap, and SPV vault contract wrappers
- signer helpers for browser and programmatic Starknet integrations
- retrying RPC and websocket helpers for chain access and realtime events

This package is intended for direct protocol integrations and for higher-level Atomiq SDK layers that need Starknet chain support.

## Installation

Install the package with its `starknet` peer dependency:

```bash
npm install @atomiqlabs/chain-starknet starknet
```

## Node-only Helpers

The default package entrypoint stays browser-safe and does not export classes that depend on Node's `fs` module.

Import backend-only utilities from the dedicated `node` subpath:

```ts
import {StarknetChainEvents, StarknetPersistentSigner} from "@atomiqlabs/chain-starknet/node";
```

## Signers

### Browser wallets

For connecting to browser wallets (Braavos, Xverse, Argent/Ready...) from within browser environments,
use `StarknetSigner` with a get-starknet `WalletAccount` — the extension handles signing.

```ts
import { connect } from "@starknet-io/get-starknet";
import { WalletAccount } from "starknet";
import { StarknetBrowserSigner } from "@atomiqlabs/chain-starknet";

// Connect the starknet wallet
const swo = await connect();

const provider = new RpcProvider({nodeUrl: starknetRpc});
const walletAccount = await WalletAccount.connect(provider, swo);
const wallet = new StarknetBrowserSigner(walletAccount);
```

### New keypair based wallets

For a programmatic integration driven by a raw private key using a simple single-key controlled OpenZeppelin
account. Use this only for newly created accounts, if you are bringing in your existing key from an already
deployed wallet account (Braavos, Xverse and Argent/Ready accounts), use the `DeployedStarkCurveWallet` described
in [Already deployed wallets](#already-deployed-wallets).

```ts
import {StarknetSigner, StarknetKeypairWallet} from "@atomiqlabs/chain-starknet";
import {RpcProvider} from "starknet";

// Generate random private key
const starknetKey: string = StarknetKeypairWallet.generateRandomPrivateKey();

const provider = new RpcProvider({nodeUrl: starknetRpc});
const wallet = new StarknetKeypairWallet(provider, starknetKey);
const starknetSigner = new StarknetSigner(wallet);
```

The account contract does not need to be deployed up front: the SDK automatically deploys it with the first
swap transaction (paying the deployment fee from the account's STRK balance).

### Already deployed wallets

For a programmatic integration driven by a raw private key controlling an **already-deployed**
account (like existing Braavos, Xverse and Argent/Ready accounts), use `DeployedStarkCurveWallet`.
A Starknet address depends on the account's class hash, so the address is passed explicitly rather
than derived. Prefer `createAndVerify` over using the constructor, which confirms — via the account's
own on-chain signature validation — that the key controls the address:

```ts
import {StarknetSigner, DeployedStarkCurveWallet} from "@atomiqlabs/chain-starknet";
import {RpcProvider} from "starknet";

const provider = new RpcProvider({nodeUrl: starknetRpc});
const wallet = await DeployedStarkCurveWallet.createAndVerify(provider, privateKey, address);
const signer = new StarknetSigner(wallet);
```

It throws `AccountNotDeployedError` if the account isn't deployed, or `WalletVerificationError`
if the key doesn't control it (or the account needs a scheme a single Stark-curve key can't
satisfy, e.g. multisig). The bare constructor performs no such check — call `verifyWallet()` first.

## Supported Chains

This package exports a single Starknet initializer:

- Starknet via `StarknetInitializer`

Canonical deployments currently defined in this package:

| Chain | Canonical deployments included |
|-------|--------------------------------|
| Starknet     | `MAINNET`, `TESTNET`, `TESTNET4`      |

By default, `StarknetInitializer` selects `SN_MAIN` Starknet network when `bitcoinNetwork` is `BitcoinNetwork.MAINNET`, and `SN_SEPOLIA` otherwise. That means both `BitcoinNetwork.TESTNET` and `BitcoinNetwork.TESTNET4` use Starknet Sepolia by default, while the BTC relay contract switches to the matching Bitcoin-network-specific deployment.

If you need a non-canonical deployment, pass explicit, `swapContract`, `spvVaultContract`, `btcRelayContract`, or handler contract overrides in the initializer options.

## SDK Example

Initialize the Atomiq SDK with Starknet network support:

```ts
import {StarknetInitializer} from "@atomiqlabs/chain-starknet";
import {BitcoinNetwork, SwapperFactory, TypedSwapper} from "@atomiqlabs/sdk";

// Define chains that you want to support here
const chains = [StarknetInitializer] as const;
type SupportedChains = typeof chains;

const Factory = new SwapperFactory<SupportedChains>(chains);

const swapper: TypedSwapper<SupportedChains> = Factory.newSwapper({
  chains: {
    STARKNET: {
      rpcUrl: starknetRpc,
      wsUrl: starknetWs // Optional, but recommended for realtime event subscriptions
    }
  },
  bitcoinNetwork: BitcoinNetwork.MAINNET // or BitcoinNetwork.TESTNET / BitcoinNetwork.TESTNET4
});
```

If you use the lower-level initializer directly, you can also override the default Starknet chain ID and canonical contract addresses independently when you need custom deployments.
