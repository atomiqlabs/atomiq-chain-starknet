import {StarknetSigner} from "./StarknetSigner";
import {Account, shortString} from "starknet";
import {bigNumberishToBuffer, serializeSignature} from "../../utils/Utils";

/**
 * A static message, which should be signed by the Starknet wallets to generate reproducible entropy. Works when
 *  wallets use signing with deterministic nonce, such that signature over the same message always yields the
 *  same signature (same entropy).
 *
 * @category Wallets
 */
export const STARKNET_REPRODUCIBLE_ENTROPY_MESSAGE = "Signing this messages generates a reproducible secret" +
    " to be used on %APPNAME%.";

/**
 * A static message, which should be signed by the Starknet wallets to generate reproducible entropy. Works when
 *  wallets use signing with deterministic nonce, such that signature over the same message always yields the
 *  same signature (same entropy).
 *
 * @category Wallets
 */
export const STARKNET_REPRODUCIBLE_ENTROPY_WARNING = "PLEASE DOUBLE CHECK THAT YOU ARE ON THE %APPNAME%" +
    " WEBSITE BEFORE SIGNING THE MESSAGE, SIGNING THIS MESSAGE ON ANY OTHER WEBSITE MIGHT LEAD TO LOSS OF FUNDS!";

const StarknetDomain = [
    { name: 'name', type: 'shortstring' },
    { name: 'version', type: 'shortstring' },
    { name: 'chainId', type: 'shortstring' },
    { name: 'revision', type: 'shortstring' },
];

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

                const message = STARKNET_REPRODUCIBLE_ENTROPY_MESSAGE.replace(new RegExp("%APPNAME%", 'g'), appName);
                const warning = STARKNET_REPRODUCIBLE_ENTROPY_WARNING.replace(new RegExp("%APPNAME%", 'g'), appName);
                const typedData = {
                    types: {
                        StarknetDomain,
                        Message: [
                            { name: 'Message', type: 'string' },
                            { name: 'Warning', type: 'string' }
                        ],
                    },
                    primaryType: 'Message',
                    domain: {
                        name: appName,
                        version: '1',
                        chainId: shortString.decodeShortString(await account.getChainId()),
                        revision: '1'
                    },
                    message: {
                        'Message': message,
                        'Warning': warning
                    }
                };

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
                if(!await account.verifyMessageInStarknet(message, signature, account.address)) throw new Error("Invalid wallet signature provided!");

                return Buffer.concat(serializedSignature.map((value) => bigNumberishToBuffer(value, 32)));
            }
        }
    }

}