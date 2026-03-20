import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { quoteInUsdt } from "./tools/quote_in_usdt";
import { simulateStableRoute } from "./tools/simulate_stable_route";

const server = new McpServer({ name: "AgentVault", version: "0.1.0" });

server.tool(
  "quote_in_usdt",
  "Get USDT-denominated quote for NFTX vault mint/redeem. Returns fee breakdown, route explanation and guards.",
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
  "Simulate full execution path for USDT→NFT vault operation. Returns step-by-step route, gas estimate, policy checks and PROCEED/WARN/ABORT recommendation.",
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

const transport = new StdioServerTransport();
server.connect(transport);
console.error("AgentVault MCP server started ✅");
