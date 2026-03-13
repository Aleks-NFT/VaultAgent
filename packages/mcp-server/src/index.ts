#!/usr/bin/env node
/**
 * VaultAgent MCP Server
 * Agent-native NFT liquidity infrastructure for NFTX protocol
 *
 * v0.1.0 — Phase 1: Read tools + simulation
 * v0.2.0 — Phase 2: Write tools (execute_mint, execute_redeem, execute_swap)
 *           Simulate → Confirm → Execute pattern. Kill-switch in FeeWrapper.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Read Tools ───────────────────────────────────────────────────────────────
import { GetVaultInfoSchema, getVaultInfo } from "./tools/get_vault_info.js";
import { GetPremiumWindowSchema, getPremiumWindow } from "./tools/get_premium_window.js";
import { SimulateMintSchema, simulateMint } from "./tools/simulate_mint.js";
import { ListVaultsSchema, listVaults } from "./tools/list_vaults.js";

// ─── Write Tools (Phase 2) ────────────────────────────────────────────────────
import { ExecuteMintSchema, executeMint } from "./tools/execute_mint.js";
import { ExecuteRedeemSchema, executeRedeem } from "./tools/execute_redeem.js";
import { ExecuteSwapSchema, executeSwap } from "./tools/execute_swap.js";

// ─── Feature flag: write tools only active if FEE_WRAPPER_ADDRESS is set ─────
const WRITE_ENABLED = Boolean(process.env.FEE_WRAPPER_ADDRESS);

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const READ_TOOLS: Tool[] = [
  {
    name: "list_vaults",
    description:
      "List active NFTX vaults with NFT counts and fee structures. " +
      "Use this first to discover available vaults for major NFT collections (CryptoPunks, Milady, Azuki, BAYC, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of vaults to return (default: 10, max: 50)",
          default: 10,
        },
        offset: {
          type: "number",
          description: "Pagination offset (default: 0)",
          default: 0,
        },
      },
    },
  },
  {
    name: "get_vault_info",
    description:
      "Get detailed information about a specific NFTX vault: " +
      "name, symbol, number of NFTs locked, fee structure (mint/redeem/swap), " +
      "and VaultAgent fee breakdown. " +
      "Accepts vault_address, vault_id, or nft_collection_address.",
    inputSchema: {
      type: "object",
      properties: {
        vault_address: {
          type: "string",
          description: "Vault contract address (0x...)",
        },
        vault_id: {
          type: "number",
          description: "Vault ID in NFTXVaultFactory registry",
        },
        nft_collection_address: {
          type: "string",
          description: "NFT collection contract address — returns all vaults for this asset",
        },
      },
    },
  },
  {
    name: "get_premium_window",
    description:
      "Analyze premium fees for targeted NFT redeem from an NFTX vault. " +
      "NFTX V3 uses a Dutch auction: premium starts at 500% and decays to 0% over 10 hours. " +
      "Returns cost breakdown, recommendation (wait vs buy now), and VaultAgent fee. " +
      "Critical for avoiding MEV and overpaying on targeted redeems. " +
      "Always run before execute_redeem with specific_ids.",
    inputSchema: {
      type: "object",
      required: ["vault_address", "token_ids"],
      properties: {
        vault_address: {
          type: "string",
          description: "NFTX vault address",
        },
        token_ids: {
          type: "array",
          items: { type: "number" },
          description: "List of NFT tokenIds to check premium for",
        },
        eth_price_wei: {
          type: "string",
          description: "Current vToken price in ETH (wei). Leave empty to use 1 ETH default.",
        },
      },
    },
  },
  {
    name: "simulate_mint",
    description:
      "Simulate depositing NFT(s) into an NFTX vault to receive vTokens. " +
      "Checks: NFT ownership, vault approval status, fee calculation, " +
      "and returns a complete pre-flight report before any on-chain action. " +
      "ALWAYS run this before execute_mint. Show the result to the user before asking for confirmation.",
    inputSchema: {
      type: "object",
      required: ["vault_address", "token_ids", "owner_address"],
      properties: {
        vault_address: {
          type: "string",
          description: "NFTX vault address",
        },
        token_ids: {
          type: "array",
          items: { type: "number" },
          description: "TokenId(s) of NFTs to deposit",
        },
        owner_address: {
          type: "string",
          description: "Current owner wallet address (for approval check)",
        },
        eth_price_per_vtoken: {
          type: "string",
          description: "vToken price in ETH (wei) for fee calculation",
        },
      },
    },
  },
];

const WRITE_TOOLS: Tool[] = [
  {
    name: "execute_mint",
    description:
      "Execute NFT deposit (mint) into an NFTX vault via VaultAgentFeeWrapper. " +
      "⚠️ WRITE OPERATION — on-chain, irreversible. " +
      "REQUIRED WORKFLOW: 1) Run simulate_mint first. 2) Show result to user. " +
      "3) Ask for explicit confirmation ('Confirm mint?'). 4) Call this with confirmed=true. " +
      "Will return AWAITING_CONFIRMATION if confirmed=false.",
    inputSchema: {
      type: "object",
      required: ["vault_address", "nft_contract", "token_ids", "owner_address", "confirmed", "simulated_vtokens_out", "simulated_fee"],
      properties: {
        vault_address: { type: "string", description: "NFTX vault address" },
        nft_contract: { type: "string", description: "NFT contract address" },
        token_ids: {
          type: "array",
          items: { type: "number" },
          description: "Token IDs to mint",
        },
        owner_address: { type: "string", description: "Executor wallet address" },
        confirmed: {
          type: "boolean",
          description: "Must be true — user explicitly confirmed the transaction",
        },
        simulated_vtokens_out: { type: "string", description: "Expected vTokens from simulation (wei)" },
        simulated_fee: { type: "string", description: "Expected VaultAgent fee from simulation (wei)" },
      },
    },
  },
  {
    name: "execute_redeem",
    description:
      "Execute NFT redeem from an NFTX vault via VaultAgentFeeWrapper. " +
      "⚠️ WRITE OPERATION — on-chain, irreversible. " +
      "REQUIRED WORKFLOW: 1) Run get_premium_window for targeted redeems. " +
      "2) Show cost to user (vTokens + ETH premium). " +
      "3) Ask for explicit confirmation. 4) Call with confirmed=true. " +
      "Use max_premium_bps to guard against price spikes (recommended: 2000 = 20%).",
    inputSchema: {
      type: "object",
      required: ["vault_address", "num_nfts", "vtoken_amount", "owner_address", "confirmed"],
      properties: {
        vault_address: { type: "string", description: "NFTX vault address" },
        num_nfts: { type: "number", description: "Number of NFTs to redeem" },
        specific_ids: {
          type: "array",
          items: { type: "number" },
          description: "Specific tokenIds to redeem (empty = random)",
          default: [],
        },
        vtoken_amount: { type: "string", description: "vToken amount in wei (from simulation)" },
        max_premium_bps: {
          type: "number",
          description: "Max premium slippage guard in bps (0=off, 2000=20%)",
          default: 0,
        },
        eth_premium_wei: {
          type: "string",
          description: "ETH premium to pay in wei (from get_premium_window)",
          default: "0",
        },
        owner_address: { type: "string", description: "Executor wallet address" },
        confirmed: {
          type: "boolean",
          description: "Must be true — user explicitly confirmed the transaction",
        },
        simulated_redeem_summary: {
          type: "string",
          description: "Human-readable summary from simulation to echo back",
        },
      },
    },
  },
  {
    name: "execute_swap",
    description:
      "Execute NFT swap within an NFTX vault via VaultAgentFeeWrapper. " +
      "Swap your NFTs for different NFTs in the same collection. " +
      "⚠️ WRITE OPERATION — on-chain, irreversible. " +
      "REQUIRED WORKFLOW: 1) Show user what they send and receive. " +
      "2) Ask for explicit confirmation. 3) Call with confirmed=true.",
    inputSchema: {
      type: "object",
      required: ["vault_address", "nft_contract", "token_ids_in", "owner_address", "confirmed"],
      properties: {
        vault_address: { type: "string", description: "NFTX vault address" },
        nft_contract: { type: "string", description: "NFT contract address" },
        token_ids_in: {
          type: "array",
          items: { type: "number" },
          description: "Token IDs you are sending in",
        },
        specific_ids_out: {
          type: "array",
          items: { type: "number" },
          description: "Token IDs you want back (empty = random)",
          default: [],
        },
        swap_fee_vtokens: {
          type: "string",
          description: "vToken fee for swap in wei (0 for same-count random swap)",
          default: "0",
        },
        owner_address: { type: "string", description: "Executor wallet address" },
        confirmed: {
          type: "boolean",
          description: "Must be true — user explicitly confirmed the transaction",
        },
      },
    },
  },
];

// Active tools: read always, write only when FEE_WRAPPER_ADDRESS set
const TOOLS: Tool[] = WRITE_ENABLED
  ? [...READ_TOOLS, ...WRITE_TOOLS]
  : READ_TOOLS;

// ─── Server Setup ─────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "vaultagent-nftx",
    version: "0.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      // ── Read ──────────────────────────────────────────────────────────────
      case "list_vaults": {
        const input = ListVaultsSchema.parse(args);
        result = await listVaults(input);
        break;
      }
      case "get_vault_info": {
        const input = GetVaultInfoSchema.parse(args);
        result = await getVaultInfo(input);
        break;
      }
      case "get_premium_window": {
        const input = GetPremiumWindowSchema.parse(args);
        result = await getPremiumWindow(input);
        break;
      }
      case "simulate_mint": {
        const input = SimulateMintSchema.parse(args);
        result = await simulateMint(input);
        break;
      }

      // ── Write (Phase 2) ───────────────────────────────────────────────────
      case "execute_mint": {
        if (!WRITE_ENABLED) {
          result = {
            error: "Write tools disabled: FEE_WRAPPER_ADDRESS not set",
            hint: "Deploy FeeWrapper.sol and configure environment",
          };
          break;
        }
        const input = ExecuteMintSchema.parse(args);
        result = await executeMint(input);
        break;
      }
      case "execute_redeem": {
        if (!WRITE_ENABLED) {
          result = {
            error: "Write tools disabled: FEE_WRAPPER_ADDRESS not set",
            hint: "Deploy FeeWrapper.sol and configure environment",
          };
          break;
        }
        const input = ExecuteRedeemSchema.parse(args);
        result = await executeRedeem(input);
        break;
      }
      case "execute_swap": {
        if (!WRITE_ENABLED) {
          result = {
            error: "Write tools disabled: FEE_WRAPPER_ADDRESS not set",
            hint: "Deploy FeeWrapper.sol and configure environment",
          };
          break;
        }
        const input = ExecuteSwapSchema.parse(args);
        result = await executeSwap(input);
        break;
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
          isError: true,
        };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: message,
            tool: name,
            hint: "Check input parameters and ensure RPC is accessible",
          }),
        },
      ],
      isError: true,
    };
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("🟢 VaultAgent MCP Server v0.2.0 started");
  console.error(`   Read tools:  ${READ_TOOLS.map((t) => t.name).join(", ")}`);
  console.error(
    `   Write tools: ${WRITE_ENABLED ? WRITE_TOOLS.map((t) => t.name).join(", ") : "DISABLED (set FEE_WRAPPER_ADDRESS)"}`
  );
  console.error(
    `   RPC: ${process.env.ETH_RPC_URL ?? "https://eth.llamarpc.com (default)"}`
  );
  console.error(
    `   FeeWrapper: ${process.env.FEE_WRAPPER_ADDRESS ?? "not set"}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
