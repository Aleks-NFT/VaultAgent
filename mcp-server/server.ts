import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { quoteInUsdt } from "./tools/quote_in_usdt.js";
import { simulateStableRoute } from "./tools/simulate_stable_route.js";
import { scanPremiumInUsd } from "./tools/scan_premium_in_usd.js";
import { mintFromUsdt } from "./tools/mint_from_usdt.js";
import { redeemToUsdt } from "./tools/redeem_to_usdt.js";

const server = new McpServer({ name: "AgentVault", version: "0.3.0" });

server.tool("quote_in_usdt", "USDT-denominated quote for NFTX vault mint/redeem with fee breakdown.",
  { vault_id: z.enum(["vMILADY", "vPUNK", "vDEATH"]), direction: z.enum(["mint", "redeem"]),
    amount_usdt: z.number().positive(), slippage_tolerance_bps: z.number().optional(), max_premium_pct: z.number().optional() },
  async (i) => ({ content: [{ type: "text", text: JSON.stringify(await quoteInUsdt(i), null, 2) }] })
);

server.tool("simulate_stable_route", "Full step-by-step execution path simulation. Returns PROCEED/WARN/ABORT.",
  { vault_id: z.enum(["vMILADY", "vPUNK", "vDEATH"]), direction: z.enum(["mint", "redeem"]),
    amount_usdt: z.number().positive(), max_slippage_bps: z.number().optional(), max_premium_pct: z.number().optional() },
  async (i) => ({ content: [{ type: "text", text: JSON.stringify(await simulateStableRoute(i), null, 2) }] })
);

server.tool("scan_premium_in_usd", "Scan all vaults for BUY/NEUTRAL/EXPENSIVE signals. Run before quoting.",
  { max_premium_pct: z.number().optional(), min_arb_usdt: z.number().optional() },
  async (i) => ({ content: [{ type: "text", text: JSON.stringify(await scanPremiumInUsd(i), null, 2) }] })
);

server.tool("mint_from_usdt", "Mint NFTX vault tokens from USDT. Runs guards, returns route + expected tokens. simulate_only: true by default.",
  { vault_id: z.enum(["vMILADY", "vPUNK", "vDEATH"]), amount_usdt: z.number().positive(),
    slippage_tolerance_bps: z.number().optional(), max_premium_pct: z.number().optional(), simulate_only: z.boolean().optional() },
  async (i) => ({ content: [{ type: "text", text: JSON.stringify(await mintFromUsdt(i), null, 2) }] })
);

server.tool("redeem_to_usdt", "Redeem NFTX vault tokens back to USDT. Runs guards, returns route + expected USDT out. simulate_only: true by default.",
  { vault_id: z.enum(["vMILADY", "vPUNK", "vDEATH"]), vault_tokens_in: z.number().positive(),
    slippage_tolerance_bps: z.number().optional(), max_premium_pct: z.number().optional(), simulate_only: z.boolean().optional() },
  async (i) => ({ content: [{ type: "text", text: JSON.stringify(await redeemToUsdt(i), null, 2) }] })
);

const transport = new StdioServerTransport();
server.connect(transport);
console.error("AgentVault MCP v0.3.0 ✅ — 5 tools ready");
