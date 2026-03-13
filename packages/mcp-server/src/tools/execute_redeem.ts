/**
 * execute_redeem.ts
 * VaultAgent Phase 2 — Write Tool
 *
 * Simulate → Show user → Await confirm → Execute on-chain
 *
 * Safety features:
 *  - confirmed gate (must be true)
 *  - maxPremiumBps slippage guard (on-chain + pre-flight)
 *  - paused check
 *  - vToken balance check
 */

import { z } from "zod";
import { createPublicClient, createWalletClient, http, parseAbi, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

// ─── Schema ────────────────────────────────────────────────────────────────────

export const ExecuteRedeemSchema = z.object({
  vault_address: z
    .string()
    .describe("NFTX vault address (0x...)"),
  num_nfts: z
    .number()
    .min(1)
    .describe("Number of NFTs to redeem"),
  specific_ids: z
    .array(z.number())
    .default([])
    .describe("Specific NFT tokenIds to redeem (empty = random from vault)"),
  vtoken_amount: z
    .string()
    .describe("vToken amount to spend in wei (from simulation). Includes NFTX fees."),
  max_premium_bps: z
    .number()
    .min(0)
    .max(50000)
    .default(0)
    .describe(
      "Max premium slippage guard in basis points (e.g. 5000 = 50%). " +
      "0 = no check. Recommended: 2000 (20%) for targeted redeems. " +
      "Agent should set this from get_premium_window result."
    ),
  eth_premium_wei: z
    .string()
    .default("0")
    .describe("ETH premium to pay for targeted redeem in wei (from get_premium_window). 0 for random."),
  owner_address: z
    .string()
    .describe("Wallet address executing the redeem"),
  confirmed: z
    .boolean()
    .describe(
      "MUST be true. Agent must show simulation result + premium info to user and receive explicit confirmation."
    ),
  simulated_redeem_summary: z
    .string()
    .optional()
    .describe("Human-readable summary from simulation to echo back to user"),
});

export type ExecuteRedeemInput = z.infer<typeof ExecuteRedeemSchema>;

// ─── ABI ───────────────────────────────────────────────────────────────────────

const WRAPPER_ABI = parseAbi([
  "function redeem(address vault, uint256 numNFTs, uint256[] calldata specificIds, uint256 vTokenAmount, uint256 maxPremiumBps) external payable returns (uint256[] memory)",
  "function paused() external view returns (bool)",
  "function feeBps() external view returns (uint256)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]);

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function executeRedeem(input: ExecuteRedeemInput): Promise<object> {
  const {
    vault_address,
    num_nfts,
    specific_ids,
    vtoken_amount,
    max_premium_bps,
    eth_premium_wei,
    owner_address,
    confirmed,
    simulated_redeem_summary,
  } = input;

  const wrapperAddress = process.env.FEE_WRAPPER_ADDRESS;
  const privateKey = process.env.EXECUTOR_PRIVATE_KEY;
  const rpcUrl = process.env.ETH_RPC_URL ?? "https://eth.llamarpc.com";

  // ── Safety gate ──────────────────────────────────────────────────────────────
  if (!confirmed) {
    const premiumEth = formatEther(BigInt(eth_premium_wei));
    const isTargeted = specific_ids.length > 0;

    return {
      status: "AWAITING_CONFIRMATION",
      message: "⚠️ Action not executed. Show this to user and await explicit confirmation.",
      action: "execute_redeem",
      vault: vault_address,
      redeem_type: isTargeted ? "TARGETED" : "RANDOM",
      specific_ids: isTargeted ? specific_ids : "random",
      num_nfts,
      vtoken_cost: vtoken_amount,
      eth_premium: isTargeted ? `${premiumEth} ETH` : "0 ETH",
      max_premium_guard: max_premium_bps > 0 ? `${max_premium_bps / 100}%` : "off",
      simulated_summary: simulated_redeem_summary ?? "Run simulate_mint to get cost breakdown",
      instruction:
        "Show user: vault, NFT IDs or 'random', vToken cost, ETH premium. Ask 'Confirm redeem?' Only set confirmed=true after user says yes.",
    };
  }

  // ── Pre-flight checks ────────────────────────────────────────────────────────
  if (!wrapperAddress) {
    return {
      status: "ERROR",
      error: "FEE_WRAPPER_ADDRESS not set",
      hint: "Deploy FeeWrapper.sol and set env var",
    };
  }

  if (!privateKey) {
    return {
      status: "ERROR",
      error: "EXECUTOR_PRIVATE_KEY not set",
    };
  }

  try {
    const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
    const account = privateKeyToAccount(`0x${privateKey.replace(/^0x/, "")}`);
    const walletClient = createWalletClient({ account, chain: mainnet, transport: http(rpcUrl) });

    // Check contract is not paused
    const isPaused = await publicClient.readContract({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: "paused",
    });

    if (isPaused) {
      return {
        status: "BLOCKED",
        error: "VaultAgent contract is paused. Contact owner.",
        paused: true,
      };
    }

    // Get fee bps
    const feeBps = await publicClient.readContract({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: "feeBps",
    });

    const vtokenBig = BigInt(vtoken_amount);
    const fee = (vtokenBig * feeBps) / 10000n;
    const totalRequired = vtokenBig + fee;

    // Check vToken balance
    const balance = await publicClient.readContract({
      address: vault_address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [owner_address as `0x${string}`],
    });

    if (balance < totalRequired) {
      return {
        status: "ERROR",
        error: "Insufficient vToken balance",
        required: totalRequired.toString(),
        available: balance.toString(),
        vault: vault_address,
        hint: "User needs more vTokens. Required = vtoken_amount + VaultAgent fee (0.25%)",
      };
    }

    // Check allowance
    const allowance = await publicClient.readContract({
      address: vault_address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [owner_address as `0x${string}`, wrapperAddress as `0x${string}`],
    });

    if (allowance < totalRequired) {
      return {
        status: "APPROVAL_REQUIRED",
        message: "vToken approval insufficient",
        required: totalRequired.toString(),
        current_allowance: allowance.toString(),
        instruction:
          "User must call approve(wrapperAddress, totalRequired) on vault token contract before redeem.",
        vault: vault_address,
        spender: wrapperAddress,
        approval_needed: true,
      };
    }

    const ethValueWei = BigInt(eth_premium_wei);

    // Estimate gas
    const gasEstimate = await publicClient.estimateContractGas({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: "redeem",
      args: [
        vault_address as `0x${string}`,
        BigInt(num_nfts),
        specific_ids.map(BigInt),
        vtokenBig,
        BigInt(max_premium_bps),
      ],
      value: ethValueWei,
      account: account.address,
    });

    // Execute
    const txHash = await walletClient.writeContract({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: "redeem",
      args: [
        vault_address as `0x${string}`,
        BigInt(num_nfts),
        specific_ids.map(BigInt),
        vtokenBig,
        BigInt(max_premium_bps),
      ],
      value: ethValueWei,
      gas: (gasEstimate * 120n) / 100n,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    return {
      status: receipt.status === "success" ? "SUCCESS" : "FAILED",
      tx_hash: txHash,
      etherscan: `https://etherscan.io/tx/${txHash}`,
      block: receipt.blockNumber.toString(),
      gas_used: receipt.gasUsed.toString(),
      vault: vault_address,
      redeem_type: specific_ids.length > 0 ? "TARGETED" : "RANDOM",
      num_nfts,
      vtoken_spent: vtoken_amount,
      vault_agent_fee: fee.toString(),
      eth_premium_paid: formatEther(ethValueWei),
      fee_wrapper: wrapperAddress,
    };
  } catch (error) {
    return {
      status: "ERROR",
      error: error instanceof Error ? error.message : String(error),
      vault: vault_address,
    };
  }
}
