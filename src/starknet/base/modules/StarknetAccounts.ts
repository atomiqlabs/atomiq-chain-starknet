import {StarknetModule} from "../StarknetModule";
import {StarknetTx} from "./StarknetTransactions";
import {DeployAccountContractPayload} from "starknet";


export class StarknetAccounts extends StarknetModule {

    public async getAccountDeployTransaction(deploymentData: DeployAccountContractPayload): Promise<StarknetTx> {
        const details = {
            ...this.root.Fees.getFeeDetails(5000, 0, await this.root.Fees.getFeeRate()),
            walletAddress: deploymentData.contractAddress,
            cairoVersion: "1" as const,
            chainId: this.root.starknetChainId,
            nonce: 0,
            accountDeploymentData: [],
            skipValidate: false
        };
        return {
            type: "DEPLOY_ACCOUNT",
            tx: deploymentData,
            details
        };
    }

}