import { ChainType } from "@atomiqlabs/base";
import { StarknetTx } from "./base/modules/StarknetTransactions";
import { StarknetSigner } from "./wallet/StarknetSigner";
import { StarknetSwapData } from "./swaps/StarknetSwapData";
import { StarknetSwapContract } from "./swaps/StarknetSwapContract";
import { StarknetChainEventsBrowser } from "./events/StarknetChainEventsBrowser";
import { StarknetBtcRelay } from "./btcrelay/StarknetBtcRelay";
import { StarknetPreFetchVerification } from "./swaps/modules/StarknetSwapInit";
export type StarknetChainType = ChainType<"STARKNET", never, StarknetPreFetchVerification, StarknetTx, StarknetSigner, StarknetSwapData, StarknetSwapContract, StarknetChainEventsBrowser, StarknetBtcRelay<any>>;
