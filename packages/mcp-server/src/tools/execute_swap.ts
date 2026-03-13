/**
 * execute_swap.ts
 * VaultAgent Phase 2 — Write Tool
 *
 * Simulate → Show user → Await confirm → Execute on-chain
 * Swap your NFTs for other NFTs within the same NFTX vault.
 *
 * Safety features:
 *  - confirmed gate
 *  - paused check
 *  - ownership verification
 *  - approval check
 */

import { z } from "zod";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

// ─── Schema ────────────────────────────────────────────────────────────────────

export const ExecuteSwapSchema = z.object({
  vault_address: z
    .string()
    .describe("NFTX vault address (0x...)"),
  nft_contract: z
    .string()
    .describe("NFT collection contract address (0x...)"),
  token_ids_in: z
    .array(z.number())
    .min(1)
    .describe("TokenIds of NFTs you are sending into the vault"),
  specific_ids_out: z
    .array(z.number())
    .default([])
    .describe("Specific tokenIds you want to receive (empty = random from vault)"),
  swap_fee_vtokens: z
    .string()
    .default("0")
    .describe("vToken amount for NFTX swap fees in wei (from simulation). 0 for same-count random swap."),
  owner_address: z
    .string()
    .describe("Wallet address executing the swap"),
  confirmed: z
    .boolean()
    .describe(
      "MUST be true. Agent must show simulation result to user and receive explicit confirmation."
    ),
});

export type ExecuteSwapInput = z.infer<typeof ExecuteSwapSchema>;

// ─── ABI ───────────────────────────────────────────────────────────────────────

const WRAPPER_ABI = parseAbi([
  "function swap(address vault, address nftContract, uint256[] calldata tokenIds, uint256[] calldata specificIds, uint256 swapFeeVTokens) external payable returns (uint256[] memory)",
  "function paused() external view returns (bool)",
  "function feeBps() external view returns (uint256)",
]);

const ERC721_ABI = parseAbi([
  "function isApprovedForAll(address owner, address operator) external view returns (bool)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
]);

const ERC20_ABI = parseAbi([
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
]);

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function executeSwap(input: ExecuteSwapInput): Promise<object> {
  const {
    vault_address,
    nft_contract,
    token_ids_in,
    specific_ids_out,
    swap_fee_vtokens,
    owner_address,
    confirmed,
  } = input;

  const wrapperAddress = process.env.FEE_WRAPPER_ADDRESS;
  const privateKey = process.env.EXECUTOR_PRIVATE_KEY;
  const rpcUrl = process.env.ETH_RPC_URL ?? "https://eth.llamarpc.com";

  // ── Safety gate ──────────────────────────────────────────────────────────────
  if (!confirmed) {
    return {
      status: "AWAITING_CONFIRMATION",
      message: "⚠️ Action not executed. Show this to user and await explicit confirmation.",
      action: "execute_swap",
      vault: vault_address,
      swap_type: specific_ids_out.length > 0 ? "TARGETED" : "RANDOM",
      sending_in: token_ids_in,
      receiving_out: specific_ids_out.length > 0 ? specific_ids_out : `${token_ids_in.length} random NFTs`,
      swap_fee_vtokens,
      instruction:
        "Show user: NFTs in, NFTs out (or 'random'), swap fee. Ask 'Confirm swap?' Only set confirmed=true after user says yes.",
    };
  }

  if (!wrapperAddress) {
    return { status: "ERROR", error: "FEE_WRAPPER_ADDRESS not set" };
  }

  if (!privateKey) {
    return { status: "ERROR", error: "EXECUTOR_PRIVATE_KEY not set" };
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
      return { status: "BLOCKED", error: "VaultAgent contract is paused.", paused: true };
    }

    // Verify NFT ownership
    const ownershipChecks = await Promise.all(
      token_ids_in.map(async (id) => {
        try {
          const nftOwner = await publicClient.readContract({
            address: nft_contract as `0x${string}`,
            abi: ERC721_ABI,
            functionName: "ownerOf",
            args: [BigInt(id)],
          });
          return {
            tokenId: id,
            owned: nftOwner.toLowerCase() === owner_address.toLowerCase(),
          };
        } catch {
          return { tokenId: id, owned: false };
        }
      })
    );

    const notOwned = ownershipChecks.filter((c) => !c.owned);
    if (notOwned.length > 0) {
      return {
        status: "ERROR",
        error: "Ownership check failed",
        not_owned: notOwned,
      };
    }

    // Check NFT approval
    const isApproved = await publicClient.readContract({
      address: nft_contract as `0x${string}`,
      abi: ERC721_ABI,
      functionName: "isApprovedForAll",
      args: [owner_address as `0x${string}`, wrapperAddress as `0x${string}`],
    });

    if (!isApproved) {
      return {
        status: "APPROVAL_REQUIRED",
        message: "NFT approval not set",
        contract: nft_contract,
        spender: wrapperAddress,
        instruction: "User must call setApprovalForAll(wrapperAddress, true) on NFT contract.",
        approval_needed: true,
      };
    }

    // Check vToken allowance if swap fees needed
    const swapFeeBig = BigInt(swap_fee_vtokens);
    if (swapFeeBig > 0n) {
      const feeBps = await publicClient.readContract({
        address: wrapperAddress as `0x${string}`,
        abi: WRAPPER_ABI,
        functionName: "feeBps",
      });
      const vaultAgentFee = (swapFeeBig * feeBps) / 10000n;
      const totalVtokenRequired = swapFeeBig + vaultAgentFee;

      const allowance = await publicClient.readContract({
        address: vault_address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [owner_address as `0x${string}`, wrapperAddress as `0x${string}`],
      });

      if (allowance < totalVtokenRequired) {
        return {
          status: "APPROVAL_REQUIRED",
          message: "vToken approval insufficient for swap fees",
          required: totalVtokenRequired.toString(),
          current_allowance: allowance.toString(),
          instruction: "User must approve vToken spending on vault contract.",
          approval_needed: true,
        };
      }
    }

    // Estimate gas
    const gasEstimate = await publicClient.estimateContractGas({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: "swap",
      args: [
        vault_address as `0x${string}`,
        nft_contract as `0x${string}`,
        token_ids_in.map(BigInt),
        specific_ids_out.map(BigInt),
        swapFeeBig,
      ],
      account: account.address,
    });

    // Execute
    const txHash = await walletClient.writeContract({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: "swap",
      args: [
        vault_address as `0x${string}`,
        nft_contract as `0x${string}`,
        token_ids_in.map(BigInt),
        specific_ids_out.map(BigInt),
        swapFeeBig,
      ],
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
      swap_type: specific_ids_out.length > 0 ? "TARGETED" : "RANDOM",
      nfts_in: token_ids_in,
      fee_wrapper: wrapperAddress,
    };
  } catch (error) {
    return {
      status: "ERROR",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
