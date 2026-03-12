import { createWalletClient, createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const privateKey = `0x${process.env.PRIVATE_KEY}` as `0x${string}`;
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });

  console.log("Deploying from:", account.address);

  const artifactPath = join(
    __dirname,
    "../artifacts/contracts/VaultAgentFeeWrapper.sol/VaultAgentFeeWrapper.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [process.env.FEE_RECIPIENT as `0x${string}`],
  });

  console.log("Transaction hash:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("✅ Contract deployed at:", receipt.contractAddress);
}

main().catch(console.error);
