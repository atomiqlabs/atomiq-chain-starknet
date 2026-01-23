import { StarknetSigner } from "./StarknetSigner";
import { Account } from "starknet";
/**
 * Browser-based Starknet signer, use with browser based signer accounts, this ensures that
 *  no signTransaction calls are made and only sendTransaction is supported!
 *
 * @category Wallets
 */
export declare class StarknetBrowserSigner extends StarknetSigner {
    constructor(account: Account);
}
