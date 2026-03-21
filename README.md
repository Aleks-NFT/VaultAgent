# VaultAgent — Stable-Denominated Execution Layer for NFT Liquidity

> AI agents speak USDT. NFT markets speak ETH. VaultAgent is the translator.

VaultAgent is an MCP server that lets any AI agent interact with NFTX vaults using stablecoins (USDT/USDC) — no ETH math, no manual routing, no gas surprises.

## Why

98.6% of AI-agent payments are in stablecoins. Yet all NFT liquidity lives in ETH-denominated vaults. VaultAgent closes that gap: agents send dollar-denominated intents, VaultAgent handles the rest (swap routing via 1inch, Chainlink pricing, slippage & premium guards, fee transparency).

## MCP Tools (v0.2.0)

| Tool | What it does |
|---|---|
| `scan_premium_in_usd` | Scan all vaults for BUY/NEUTRAL/EXPENSIVE signals. Run this first. |
| `quote_in_usdt` | Get full USDT-denominated quote with fee breakdown before committing. |
| `simulate_stable_route` | Simulate step-by-step execution path — get PROCEED/WARN/ABORT before any tx. |

## Quick Start

```bash
git clone https://github.com/Aleks-NFT/AgentVault
cd AgentVault/mcp-server
npm install
cp ../.env.example .env   # fill in your RPC URL + vault addresses
npx tsx server.ts
```

## Example: scan_premium_in_usd

```json
{
  "best_opportunity": {
    "vault_id": "vPUNK",
    "floor_usdt": 104013,
    "premium_pct": 0.8,
    "signal": "NEUTRAL",
    "reason": "Premium 0.8% within threshold (2%). Acceptable entry."
  },
  "summary": "Best entry: vPUNK @ 0.8% premium ($104013 USDT floor). 0 BUY / 2 NEUTRAL / 1 EXPENSIVE signals."
}
```

## Fee Model

| Layer | Fee |
|---|---|
| Execution fee | 0.35% of volume |
| Routing spread (1inch) | ~0.30% |
| **Total round-trip** | **~0.65%** |

Intelligence queries (pre-sim, quote) → `$0.001 USDC` via Coinbase x402 *(roadmap)*

## Roadmap

- `v0.3` — `mint_from_usdt` + `redeem_to_usdt` execution tools
- `v0.4` — x402 micropayments for intelligence layer
- `v1.0` — AgentHUB Console: ERC-8004 trust profiles, budget management, live logs

## Built for Synthesis Hackathon

VaultAgent is the execution engine. AgentHUB is the terminal. Together: an OS for agents that manage capital.

---
*MCP v0.2.0 · 3 tools · Base L2 target · MIT License*
