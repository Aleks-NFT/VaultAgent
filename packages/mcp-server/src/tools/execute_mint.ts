/**
 * execute_mint.ts
 * VaultAgent Phase 2 — Write Tool
 *
 * Simulate → Show user → Await confirm → Execute on-chain
 *
 * Safety: never executes without explicit user confirmation in the same turn.
 * The agent MUST show simulate_intent result to the user before calling execute.
 */

import { z } from "zod";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

// ─── Schema ────────────────────────────────────────────────────────────────────

export const ExecuteMintSchema = z.object({
  vault_address: z
    .string()
    .describe("NFTX vault address (0x...)"),
  nft_contract: z
    .string()
    .describe("NFT collection contract address (0x...)"),
  token_ids: z
    .array(z.number())
    .min(1)
    .describe("Array of NFT tokenIds to deposit into the vault"),
  owner_address: z
    .string()
    .describe("Wallet address executing the mint"),
  confirmed: z
    .boolean()
    .describe(
      "MUST be true. Agent must show simulation result to user and receive explicit confirmation before setting this to true."
    ),
  simulated_vtokens_out: z
    .string()
    .describe("Expected vTokens from simulation (wei string). Used for verification."),
  simulated_fee: z
    .string()
    .describe("Expected VaultAgent fee from simulation (wei string). Used for verification."),
});

export type ExecuteMintInput = z.infer<typeof ExecuteMintSchema>;

// ─── ABI ───────────────────────────────────────────────────────────────────────

const WRAPPER_ABI = parseAbi([
  "function mint(address vault, address nftContract, uint256[] calldata tokenIds) external payable returns (uint256)",
  "function paused() external view returns (bool)",
  "function feeBps() external view returns (uint256)",
]);

const ERC721_ABI = parseAbi([
  "function isApprovedForAll(address owner, address operator) external view returns (bool)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
]);

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function executeMint(input: ExecuteMintInput): Promise<object> {
  const {
    vault_address,
    nft_contract,
    token_ids,
    owner_address,
    confirmed,
    simulated_vtokens_out,
    simulated_fee,
  } = input;

  const wrapperAddress = process.env.FEE_WRAPPER_ADDRESS;
  const privateKey = process.env.EXECUTOR_PRIVATE_KEY;
  const rpcUrl = process.env.ETH_RPC_URL ?? "https://eth.llamarpc.com";

  // ── Safety gate: confirmation required ──────────────────────────────────────
  if (!confirmed) {
    return {
      status: "AWAITING_CONFIRMATION",
      message:
        "⚠️ Action not executed. You must show this simulation to the user and receive explicit confirmation before proceeding.",
      action: "execute_mint",
      vault: vault_address,
      token_ids,
      simulated_vtokens_out,
      simulated_fee,
      instruction:
        "Show the user: vault, token_ids, expected vTokens, fee, and gas estimate. Ask: 'Confirm mint?' Only set confirmed=true after user says yes.",
    };
  }

  // ── Pre-flight checks ────────────────────────────────────────────────────────
  if (!wrapperAddress) {
    return {
      status: "ERROR",
      error: "FEE_WRAPPER_ADDRESS not set in environment",
      hint: "Deploy FeeWrapper.sol first and set FEE_WRAPPER_ADDRESS env var",
    };
  }

  if (!privateKey) {
    return {
      status: "ERROR",
      error: "EXECUTOR_PRIVATE_KEY not set in environment",
      hint: "Set wallet private key in environment (use a dedicated executor wallet)",
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

    // Verify NFT ownership
    const ownershipChecks = await Promise.all(
      token_ids.map(async (id) => {
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
            owner: nftOwner,
          };
        } catch {
          return { tokenId: id, owned: false, owner: null };
        }
      })
    );

    const notOwned = ownershipChecks.filter((c) => !c.owned);
    if (notOwned.length > 0) {
      return {
        status: "ERROR",
        error: "Ownership check failed",
        not_owned: notOwned,
        hint: "Wallet does not own these NFTs. Check token_ids and owner_address.",
      };
    }

    // Check approval
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
        instruction:
          "User must call setApprovalForAll(wrapperAddress, true) on the NFT contract before mint can proceed.",
        approval_needed: true,
      };
    }

    // Estimate gas
    const gasEstimate = await publicClient.estimateContractGas({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: "mint",
      args: [
        vault_address as `0x${string}`,
        nft_contract as `0x${string}`,
        token_ids.map(BigInt),
      ],
      account: account.address,
    });

    // Execute
    const txHash = await walletClient.writeContract({
      address: wrapperAddress as `0x${string}`,
      abi: WRAPPER_ABI,
      functionName: "mint",
      args: [
        vault_address as `0x${string}`,
        nft_contract as `0x${string}`,
        token_ids.map(BigInt),
      ],
      gas: (gasEstimate * 120n) / 100n, // 20% buffer
    });

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    return {
      status: receipt.status === "success" ? "SUCCESS" : "FAILED",
      tx_hash: txHash,
      etherscan: `https://etherscan.io/tx/${txHash}`,
      block: receipt.blockNumber.toString(),
      gas_used: receipt.gasUsed.toString(),
      vault: vault_address,
      token_ids,
      simulated_vtokens_out,
      simulated_fee,
      fee_wrapper: wrapperAddress,
    };
  } catch (error) {
    return {
      status: "ERROR",
      error: error instanceof Error ? error.message : String(error),
      vault: vault_address,
      token_ids,
    };
  }
}
