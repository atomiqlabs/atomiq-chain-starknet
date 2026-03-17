import {StarknetSigner} from "./StarknetSigner";
import {Account, shortString} from "starknet";
import {bigNumberishToBuffer, serializeSignature} from "../../utils/Utils";

/**
 * Browser-based Starknet signer, use with browser based signer accounts, this ensures that
 *  no signTransaction calls are made and only sendTransaction is supported!
 *
 * @category Wallets
 */
export class StarknetBrowserSigner extends StarknetSigner {

    private usesECDSADN?: boolean;

    getReproducibleEntropy?: (appName: string) => Promise<Buffer>;

    /**
     * @param account Signer account to request signatures and send transaction through
     * @param usesECDSADN Optional flag indicating whether the signer supports signing using ECDSA-DN (deterministic
     *  nonce) algorithm, this allows the wallet to produce reproducible entropy. Only pass `true` here if you are
     *  100% sure that the signer supports this!
     */
    constructor(account: Account, usesECDSADN?: boolean) {
        super(account, false);
        this.usesECDSADN = usesECDSADN;
        this.signTransaction = undefined;
        if(this.usesECDSADN!==false) {
            this.getReproducibleEntropy = async (appName: string) => {
                if(this.usesECDSADN===false) throw new Error("This wallet doesn't support generating recoverable entropy!");

                const typedData = StarknetSigner.getReproducibleEntropyMessage(await account.getChainId(), appName);

                const signature = await account.signMessage(typedData);
                const serializedSignature = serializeSignature(signature)!;
                if(this.usesECDSADN!==true) {
                    const secondSignature = serializeSignature(await account.signMessage(typedData))!;
                    if(
                        serializedSignature.length===secondSignature.length &&
                        serializedSignature.every((value, index) => secondSignature[index] === value)
                    ) {
                        this.usesECDSADN = true;
                    } else {
                        this.usesECDSADN = false;
                        this.getReproducibleEntropy = undefined;
                        throw new Error("This wallet doesn't support generating recoverable entropy!");
                    }
                }

                return Buffer.concat(serializedSignature.map((value) => bigNumberishToBuffer(value, 32)));
            }
        }
    }

}