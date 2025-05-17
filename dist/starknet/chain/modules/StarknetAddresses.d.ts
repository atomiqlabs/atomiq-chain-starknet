import { StarknetModule } from "../StarknetModule";
export declare class StarknetAddresses extends StarknetModule {
    /**
     * Checks whether an address is a valid starknet address
     *
     * @param value
     */
    static isValidAddress(value: string): boolean;
}
