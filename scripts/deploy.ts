/**
 * VaultAgent — Mainnet Deploy Script
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network mainnet
 *   npx hardhat run scripts/deploy.ts --network sepolia
 *
 * Required .env:
 *   PRIVATE_KEY          — deployer wallet (without 0x)
 *   MAINNET_RPC_URL      — e.g. https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
 *   FEE_RECIPIENT        — address that receives 0.25% fees (your new wallet)
 *   ETHERSCAN_API_KEY    — for contract verification
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { execSync } from "child_process";
import * as dotenv from "dotenv";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Config ───────────────────────────────────────────────────────────────────

const NETWORK = process.env.HARDHAT_NETWORK ?? "mainnet";
const IS_MAINNET = NETWORK === "mainnet";

const RPC_URL = IS_MAINNET
  ? process.env.MAINNET_RPC_URL!
  : process.env.SEPOLIA_RPC_URL!;

const CHAIN = IS_MAINNET ? mainnet : sepolia;
const EXPLORER = IS_MAINNET
  ? "https://etherscan.io"
  : "https://sepolia.etherscan.io";

const FEE_RECIPIENT = process.env.FEE_RECIPIENT as `0x${string}`;
const FEE_BPS = 25n; // 0.25%

// ─── Validation ───────────────────────────────────────────────────────────────

function validate() {
  const missing: string[] = [];
  if (!process.env.PRIVATE_KEY) missing.push("PRIVATE_KEY");
  if (!RPC_URL) missing.push(IS_MAINNET ? "MAINNET_RPC_URL" : "SEPOLIA_RPC_URL");
  if (!FEE_RECIPIENT) missing.push("FEE_RECIPIENT");

  if (missing.length > 0) {
    console.error("❌ Missing required env vars:", missing.join(", "));
    process.exit(1);
  }

  if (!FEE_RECIPIENT.startsWith("0x") || FEE_RECIPIENT.length !== 42) {
    console.error("❌ FEE_RECIPIENT is not a valid address:", FEE_RECIPIENT);
    process.exit(1);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  validate();

  const privateKey = `0x${process.env.PRIVATE_KEY}` as `0x${string}`;
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: CHAIN, transport: http(RPC_URL) });

  // Balance check
  const balance = await publicClient.getBalance({ address: account.address });
  const balanceEth = Number(balance) / 1e18;

  console.log("\n🚀 VaultAgent FeeWrapper Deploy");
  console.log("================================");
  console.log(`Network:       ${NETWORK} (chainId: ${CHAIN.id})`);
  console.log(`Deployer:      ${account.address}`);
  console.log(`Balance:       ${balanceEth.toFixed(4)} ETH`);
  console.log(`Fee recipient: ${FEE_RECIPIENT}`);
  console.log(`Fee:           ${FEE_BPS} bps (${Number(FEE_BPS) / 100}%)`);

  if (IS_MAINNET && balanceEth < 0.01) {
    console.error("❌ Insufficient ETH for mainnet deploy (need at least 0.01 ETH)");
    process.exit(1);
  }

  // Load artifact
  const artifactPath = join(
    __dirname,
    "../artifacts/contracts/VaultAgentFeeWrapper.sol/VaultAgentFeeWrapper.json"
  );

  if (!fs.existsSync(artifactPath)) {
    console.error("❌ Artifact not found. Run: npx hardhat compile");
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  console.log("\nDeploying...");

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [FEE_RECIPIENT, FEE_BPS],
  });

  console.log(`TX hash: ${EXPLORER}/tx/${hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress!;

  console.log("\n✅ Deployed!");
  console.log(`Contract:  ${contractAddress}`);
  console.log(`Etherscan: ${EXPLORER}/address/${contractAddress}`);
  console.log(`Gas used:  ${receipt.gasUsed.toString()}`);

  // Save deployment info
  const deployInfo = {
    network: NETWORK,
    chainId: CHAIN.id,
    contractAddress,
    txHash: hash,
    deployer: account.address,
    feeRecipient: FEE_RECIPIENT,
    feeBps: Number(FEE_BPS),
    blockNumber: receipt.blockNumber.toString(),
    timestamp: new Date().toISOString(),
  };

  const deployPath = join(__dirname, `../deployments/${NETWORK}.json`);
  fs.mkdirSync(dirname(deployPath), { recursive: true });
  fs.writeFileSync(deployPath, JSON.stringify(deployInfo, null, 2));
  console.log(`\nDeployment saved: deployments/${NETWORK}.json`);

  // Verify hint
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("\nVerifying on Etherscan...");
    try {
      execSync(
        `npx hardhat verify --network ${NETWORK} ${contractAddress} "${FEE_RECIPIENT}" "${FEE_BPS}"`,
        { stdio: "inherit" }
      );
    } catch {
      console.log("⚠️  Auto-verify failed. Run manually:");
      console.log(`npx hardhat verify --network ${NETWORK} ${contractAddress} "${FEE_RECIPIENT}" "${FEE_BPS}"`);
    }
  } else {
    console.log("\n💡 To verify manually:");
    console.log(`npx hardhat verify --network ${NETWORK} ${contractAddress} "${FEE_RECIPIENT}" "${FEE_BPS}"`);
  }

  console.log("\n📋 Add to .env:");
  console.log(`FEE_WRAPPER_ADDRESS=${contractAddress}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
