import {StarknetModule} from "../StarknetModule";
import {validateAndParseAddress} from "starknet";

export class StarknetAddresses extends StarknetModule {

    ///////////////////
    //// Address utils
    /**
     * Checks whether an address is a valid starknet address
     *
     * @param value
     */
    isValidAddress(value: string): boolean {
        if(value.length!==66) return false;
        try {
            validateAndParseAddress(value);
            return true;
        } catch (e) {
            return false;
        }
    }

}