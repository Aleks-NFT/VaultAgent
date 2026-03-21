import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { quoteInUsdt } from "./tools/quote_in_usdt.js";
import { simulateStableRoute } from "./tools/simulate_stable_route.js";
import { scanPremiumInUsd } from "./tools/scan_premium_in_usd.js";

const server = new McpServer({ name: "AgentVault", version: "0.2.0" });

server.tool(
  "quote_in_usdt",
  "Get USDT-denominated quote for NFTX vault mint/redeem. Returns live ETH price, fee breakdown, expected vault tokens, route explanation and guards.",
  {
    vault_id: z.enum(["vMILADY", "vPUNK", "vDEATH"]),
    direction: z.enum(["mint", "redeem"]),
    amount_usdt: z.number().positive(),
    slippage_tolerance_bps: z.number().optional(),
    max_premium_pct: z.number().optional(),
  },
  async (input) => ({
    content: [{ type: "text", text: JSON.stringify(await quoteInUsdt(input), null, 2) }]
  })
);

server.tool(
  "simulate_stable_route",
  "Simulate full step-by-step execution path for USDT→NFT vault operation. Returns route steps, gas estimate in USD, policy checks and PROCEED/WARN/ABORT recommendation.",
  {
    vault_id: z.enum(["vMILADY", "vPUNK", "vDEATH"]),
    direction: z.enum(["mint", "redeem"]),
    amount_usdt: z.number().positive(),
    max_slippage_bps: z.number().optional(),
    max_premium_pct: z.number().optional(),
  },
  async (input) => ({
    content: [{ type: "text", text: JSON.stringify(await simulateStableRoute(input), null, 2) }]
  })
);

server.tool(
  "scan_premium_in_usd",
  "Scan all NFTX vaults for premium windows. Returns BUY/NEUTRAL/EXPENSIVE signals, arbitrage opportunity in USDT, and best entry recommendation. Use before quoting to find optimal entry.",
  {
    max_premium_pct: z.number().optional().describe("Max acceptable premium % (default 2.0)"),
    min_arb_usdt: z.number().optional().describe("Min arb opportunity in USDT to flag (default 50)"),
  },
  async (input) => ({
    content: [{ type: "text", text: JSON.stringify(await scanPremiumInUsd(input), null, 2) }]
  })
);

const transport = new StdioServerTransport();
server.connect(transport);
console.error("AgentVault MCP v0.2.0 started ✅ — 3 tools: quote_in_usdt, simulate_stable_route, scan_premium_in_usd");
