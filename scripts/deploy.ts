import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(`0x${process.env.PRIVATE_KEY}`, provider);
  
  console.log("Deploying from:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Load artifacts
  const feeWrapperArtifact = JSON.parse(
    fs.readFileSync(path.join("artifacts/contracts/VaultAgentFeeWrapper.sol/VaultAgentFeeWrapper.json"), "utf8")
  );
  const routerArtifact = JSON.parse(
    fs.readFileSync(path.join("artifacts/contracts/StableVaultRouter.sol/StableVaultRouter.json"), "utf8")
  );

  // 1. Deploy VaultAgentFeeWrapper
  console.log("\n📦 Deploying VaultAgentFeeWrapper...");
  const FeeWrapperFactory = new ethers.ContractFactory(feeWrapperArtifact.abi, feeWrapperArtifact.bytecode, wallet);
  const feeWrapper = await FeeWrapperFactory.deploy(wallet.address, 25n);
  await feeWrapper.waitForDeployment();
  const feeWrapperAddr = await feeWrapper.getAddress();
  console.log("✅ VaultAgentFeeWrapper:", feeWrapperAddr);

  // 2. Deploy StableVaultRouter
  console.log("\n📦 Deploying StableVaultRouter...");
  const RouterFactory = new ethers.ContractFactory(routerArtifact.abi, routerArtifact.bytecode, wallet);
  const router = await RouterFactory.deploy(feeWrapperAddr, wallet.address);
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log("✅ StableVaultRouter:", routerAddr);

  console.log("\n🚀 Deployment complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("VaultAgentFeeWrapper:", feeWrapperAddr);
  console.log("StableVaultRouter:   ", routerAddr);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`\nFEE_WRAPPER_ADDRESS=${feeWrapperAddr}`);
  console.log(`STABLE_VAULT_ROUTER_ADDRESS=${routerAddr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
