import { StarknetSigner } from "./StarknetSigner";
import { Account } from "starknet";
/**
 * Browser-based Starknet signer for external wallet integration
 * @category Wallets
 */
export declare class StarknetBrowserSigner extends StarknetSigner {
    constructor(account: Account);
}
