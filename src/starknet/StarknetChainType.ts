import {ChainType} from "@atomiqlabs/base";
import {StarknetTx} from "./chain/modules/StarknetTransactions";
import {StarknetSigner} from "./wallet/StarknetSigner";
import {StarknetSwapData} from "./swaps/StarknetSwapData";
import {StarknetSwapContract} from "./swaps/StarknetSwapContract";
import {StarknetChainEventsBrowser} from "./events/StarknetChainEventsBrowser";
import {StarknetBtcRelay} from "./btcrelay/StarknetBtcRelay";
import {StarknetPreFetchVerification} from "./swaps/modules/StarknetSwapInit";
import {StarknetChainInterface} from "./chain/StarknetChainInterface";

export type StarknetChainType = ChainType<
    "STARKNET",
    never,
    StarknetPreFetchVerification,
    StarknetTx,
    StarknetSigner,
    StarknetSwapData,
    StarknetSwapContract,
    StarknetChainInterface,
    StarknetChainEventsBrowser,
    StarknetBtcRelay<any>,
    never,
    never
>;
