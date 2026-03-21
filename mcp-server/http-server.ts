import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { quoteInUsdt } from "./tools/quote_in_usdt.js";
import { scanPremiumInUsd } from "./tools/scan_premium_in_usd.js";

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const PAY_TO = process.env.WALLET_ADDRESS ?? "0x0000000000000000000000000000000000000000";
const PORT   = process.env.HTTP_PORT ?? 4021;

// x402 setup — Base Sepolia testnet
const facilitator = new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });
const resourceServer = new x402ResourceServer(facilitator)
  .register("eip155:84532", new ExactEvmScheme());

app.use(
  paymentMiddleware(
    {
      "POST /quote": {
        accepts: [{ scheme: "exact", price: "$0.001", network: "eip155:84532", payTo: PAY_TO }],
        description: "USDT-denominated quote for NFTX vault mint/redeem",
        mimeType: "application/json",
      },
      "POST /scan": {
        accepts: [{ scheme: "exact", price: "$0.001", network: "eip155:84532", payTo: PAY_TO }],
        description: "Scan all vaults for premium signals (BUY/NEUTRAL/EXPENSIVE)",
        mimeType: "application/json",
      },
    },
    resourceServer,
  )
);

// Intelligence endpoints (paid)
app.post("/quote", async (req, res) => {
  const result = await quoteInUsdt(req.body);
  res.json(result);
});

app.post("/scan", async (req, res) => {
  const result = await scanPremiumInUsd(req.body ?? {});
  res.json(result);
});

// Public health check
app.get("/", (_req, res) => {
  res.json({
    name: "AgentVault Intelligence API",
    version: "0.3.0",
    x402: true,
    pricing: {
      "POST /quote": "$0.001 USDC",
      "POST /scan":  "$0.001 USDC",
    },
    execution: "via MCP tools mint_from_usdt / redeem_to_usdt (0.65% round-trip)",
  });
});


// Free scan for internal dashboard (no x402)
app.post("/scan/free", async (req, res) => {
  const result = await scanPremiumInUsd(req.body ?? {});
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`AgentVault HTTP x402 server on http://localhost:${PORT}`);
});
