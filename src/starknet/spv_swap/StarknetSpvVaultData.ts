import {
    SpvVaultClaimEvent,
    SpvVaultCloseEvent,
    SpvVaultData, SpvVaultDepositEvent, SpvVaultOpenEvent,
    SpvVaultTokenBalance,
    SpvVaultTokenData
} from "@atomiqlabs/base";
import {BigNumberish} from "starknet";
import {Serialized, toBigInt, toHex} from "../../utils/Utils";
import {Buffer} from "buffer";
import {StarknetSpvWithdrawalData} from "./StarknetSpvWithdrawalData";

export type StarknetSpvVaultDataType = {
    relay_contract: BigNumberish,
    token_0: BigNumberish,
    token_1: BigNumberish,
    token_0_multiplier: BigNumberish,
    token_1_multiplier: BigNumberish,
    utxo: Record<number, boolean | object | BigNumberish>,
    confirmations: BigNumberish,
    withdraw_count: BigNumberish,
    deposit_count: BigNumberish,
    token_0_amount: BigNumberish,
    token_1_amount: BigNumberish
};

export type StarknetSpvVaultDataCtorArgs = {
    owner: string,
    vaultId: bigint,
    struct: StarknetSpvVaultDataType,
    initialUtxo?: string
};

function isSerializedData(obj: any): obj is ({type: "STARKNET"} & Serialized<StarknetSpvVaultData>) {
    return obj.type==="STARKNET";
}

/**
 * Represents the state of the SPV vault (UTXO-controlled vault)
 *
 * @category Swaps
 */
export class StarknetSpvVaultData extends SpvVaultData<StarknetSpvWithdrawalData> {

    readonly owner: string;
    readonly vaultId: bigint;

    readonly relayContract: string;
    readonly token0: {
        token: string,
        multiplier: bigint,
        rawAmount: bigint
    }
    readonly token1: {
        token: string,
        multiplier: bigint,
        rawAmount: bigint
    };
    readonly initialUtxo?: string;
    readonly confirmations: number;

    utxo: string;
    withdrawCount: number;
    depositCount: number;

    /**
     * Creates a new spv vault data based on the provided arguments
     *
     * @param args
     */
    constructor(args: StarknetSpvVaultDataCtorArgs);

    /**
     * Deserializes the spv vault data from its serialized implementation (returned from {@link StarknetSpvVaultData.serialize})
     *
     * @param data
     */
    constructor(data: (Serialized<StarknetSpvVaultData> & {type: "STARKNET"}));

    constructor(data: StarknetSpvVaultDataCtorArgs | (Serialized<StarknetSpvVaultData> & {type: "STARKNET"})) {
        super();
        if(!isSerializedData(data)) {
            if(data.vaultId==null) throw new Error("vaultId is null");
            if(data.struct==null) throw new Error("state is null");

            this.owner = data.owner;
            this.vaultId = data.vaultId;
            this.relayContract = toHex(data.struct.relay_contract);
            this.token0 = {
                token: toHex(data.struct.token_0),
                multiplier: toBigInt(data.struct.token_0_multiplier),
                rawAmount: toBigInt(data.struct.token_0_amount)
            };
            this.token1 = {
                token: toHex(data.struct.token_1),
                multiplier: toBigInt(data.struct.token_1_multiplier),
                rawAmount: toBigInt(data.struct.token_1_amount)
            };
            const txHash = Buffer.from(toBigInt(data.struct.utxo["0"] as BigNumberish).toString(16).padStart(64, "0"), "hex");
            const vout = toBigInt(data.struct.utxo["1"] as BigNumberish);
            this.utxo = txHash.reverse().toString("hex")+":"+vout.toString(10);
            this.confirmations = Number(toBigInt(data.struct.confirmations));
            this.withdrawCount = Number(toBigInt(data.struct.withdraw_count));
            this.depositCount = Number(toBigInt(data.struct.deposit_count));
            this.initialUtxo = data.initialUtxo;
        } else {
            this.owner = data.owner;
            this.vaultId = BigInt(data.vaultId);
            this.relayContract = data.relayContract;
            this.token0 = {
                token: data.token0.token,
                multiplier: BigInt(data.token0.multiplier),
                rawAmount: BigInt(data.token0.rawAmount)
            }
            this.token1 = {
                token: data.token1.token,
                multiplier: BigInt(data.token1.multiplier),
                rawAmount: BigInt(data.token1.rawAmount)
            };
            this.utxo = data.utxo;
            this.confirmations = data.confirmations;
            this.withdrawCount = data.withdrawCount;
            this.depositCount = data.depositCount;
            this.initialUtxo = data.initialUtxo;
        }
    }

    /**
     * @inheritDoc
     */
    getBalances(): SpvVaultTokenBalance[] {
        return [
            {...this.token0, scaledAmount: this.token0.rawAmount * this.token0.multiplier},
            {...this.token1, scaledAmount: this.token1.rawAmount * this.token1.multiplier}
        ];
    }

    /**
     * @inheritDoc
     */
    getConfirmations(): number {
        return this.confirmations;
    }

    /**
     * @inheritDoc
     */
    getOwner(): string {
        return this.owner;
    }

    /**
     * @inheritDoc
     */
    getTokenData(): SpvVaultTokenData[] {
        return [this.token0, this.token1];
    }

    /**
     * @inheritDoc
     */
    getUtxo(): string {
        return this.isOpened() ? this.utxo : this.initialUtxo!;
    }

    /**
     * @inheritDoc
     */
    getVaultId(): bigint {
        return this.vaultId;
    }

    /**
     * @inheritDoc
     */
    getWithdrawalCount(): number {
        return this.withdrawCount;
    }

    /**
     * @inheritDoc
     */
    isOpened(): boolean {
        return this.utxo!=="0000000000000000000000000000000000000000000000000000000000000000:0";
    }

    /**
     * @inheritDoc
     */
    serialize(): (Serialized<StarknetSpvVaultData> & {type: "STARKNET"}) {
        return {
            type: "STARKNET",
            owner: this.owner,
            vaultId: this.vaultId.toString(10),
            relayContract: this.relayContract,
            token0: {
                token: this.token0.token,
                multiplier: this.token0.multiplier.toString(10),
                rawAmount: this.token0.rawAmount.toString(10)
            },
            token1: {
                token: this.token1.token,
                multiplier: this.token1.multiplier.toString(10),
                rawAmount: this.token1.rawAmount.toString(10)
            },
            utxo: this.utxo,
            confirmations: this.confirmations,
            withdrawCount: this.withdrawCount,
            depositCount: this.depositCount,
            initialUtxo: this.initialUtxo
        }
    }

    /**
     * @inheritDoc
     */
    updateState(withdrawalTxOrEvent: SpvVaultClaimEvent | SpvVaultCloseEvent | SpvVaultOpenEvent | SpvVaultDepositEvent | StarknetSpvWithdrawalData): void {
        if(withdrawalTxOrEvent instanceof SpvVaultClaimEvent) {
            if(withdrawalTxOrEvent.withdrawCount <= this.withdrawCount) return;
            this.token0.rawAmount -= withdrawalTxOrEvent.amounts[0];
            this.token1.rawAmount -= withdrawalTxOrEvent.amounts[1];
            this.withdrawCount = withdrawalTxOrEvent.withdrawCount;
            this.utxo = withdrawalTxOrEvent.btcTxId+":0";
        }
        if(withdrawalTxOrEvent instanceof SpvVaultCloseEvent) {
            this.token0.rawAmount = 0n;
            this.token1.rawAmount = 0n;
            this.utxo = "0000000000000000000000000000000000000000000000000000000000000000:0";
        }
        if(withdrawalTxOrEvent instanceof SpvVaultOpenEvent) {
            if(this.isOpened()) return;
            this.utxo = withdrawalTxOrEvent.btcTxId+":"+withdrawalTxOrEvent.vout;
        }
        if(withdrawalTxOrEvent instanceof SpvVaultDepositEvent) {
            if(withdrawalTxOrEvent.depositCount <= this.depositCount) return;
            this.token0.rawAmount += withdrawalTxOrEvent.amounts[0];
            this.token1.rawAmount += withdrawalTxOrEvent.amounts[1];
            this.depositCount = withdrawalTxOrEvent.depositCount;
        }
        if(withdrawalTxOrEvent instanceof StarknetSpvWithdrawalData) {
            if(withdrawalTxOrEvent.getSpentVaultUtxo()!==this.utxo) return;
            const amounts = withdrawalTxOrEvent.getTotalOutput();
            this.token0.rawAmount -= amounts[0];
            this.token1.rawAmount -= amounts[1];
            this.withdrawCount++;
            this.utxo = withdrawalTxOrEvent.btcTx.txid+":0";
        }
    }

    /**
     * @inheritDoc
     */
    getDepositCount(): number {
        return this.depositCount;
    }

}

SpvVaultData.deserializers["STARKNET"] = StarknetSpvVaultData;
