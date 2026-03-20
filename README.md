# AgentVault — Stablecoin-Native Execution Layer for NFT Liquidity

> **Synthesis Hackathon 2026** — Track: Agents that Pay

AgentVault lets AI agents buy and sell NFT vault tokens using USDT/USDC — no ETH required.
Quote → Simulate → Execute. Fully on-chain, explain-before-execute, MCP-native.

---

## The Problem

NFT liquidity lives in ETH. AI agents operate in stablecoins.
Every USDT→NFT operation requires manual ETH bridging, slippage guessing, and gas management.
There is no programmable, stablecoin-denominated execution layer for NFT vaults.

## The Solution

AgentVault is a stable-rail execution middleware:
- **Input:** USDT or USDC
- **Route:** 1inch swap → NFTX vault mint/redeem → FeeWrapper
- **Output:** vTokens (or USDT back on redeem)
- **Intelligence:** MCP tools simulate and quote before any on-chain action

---

## Architecture


---

## MCP Tools

### `quote_in_usdt`
Returns live USDT-denominated quote with fee breakdown and guards.

```json
{
  "vault_id": "vMILADY",
  "direction": "mint",
  "amount_usdt": 1000
}
```

**Response:**
```json
{
  "status": "ok",
  "quote": { "expected_vtokens": 0.2163 },
  "fees": { "total_fees_usdt": 4.50, "effective_rate_pct": 0.45 },
  "market": { "eth_usd_price": 2165.31 },
  "route_explanation": "1000 USDT → WETH via 1inch → mint 0.2163 vMILADY. ✅ OK."
}
```

### `simulate_stable_route`
Returns step-by-step execution path with gas estimate and policy verdict.

```json
{
  "recommendation": "PROCEED",
  "steps": [
    { "step": 1, "action": "Approve USDT → 1inch Router", "gas_est_usd": 0.32 },
    { "step": 2, "action": "Swap USDT → WETH",            "gas_est_usd": 0.80 },
    { "step": 3, "action": "Approve WETH → NFTX Vault",   "gas_est_usd": 0.32 },
    { "step": 4, "action": "Mint vMILADY tokens",         "gas_est_usd": 0.80 }
  ],
  "summary": { "total_gas_est_usd": 2.24, "total_fees_usdt": 4.50 },
  "policy": { "slippage_check": "PASS", "premium_check": "PASS", "oracle_check": "PASS" }
}
```

---

## Fee Stack

| Fee | Rate |
|-----|------|
| 1inch entry (USDT→WETH) | 0.10% |
| Execution fee | 0.25% |
| Stablecoin convenience | 0.10% |
| 1inch exit (redeem only) | 0.10% |
| **Total round-trip** | **~0.45–0.55%** |

---

## Deployed Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| VaultAgentFeeWrapper | [`0x932977d95e3bfdAfa5547b0dca1a829F260Ff450`](https://sepolia.etherscan.io/address/0x932977d95e3bfdAfa5547b0dca1a829F260Ff450#code) |
| StableVaultRouter | [`0xBBc6f4B9C6Da8543e200667B87Ba8f44725edB8f`](https://sepolia.etherscan.io/address/0xBBc6f4B9C6Da8543e200667B87Ba8f44725edB8f#code) |

Both contracts verified ✅ on Sepolia Etherscan.

---

## Supported Vaults

| vault_id | NFT Collection | Protocol |
|----------|---------------|----------|
| vMILADY | Milady Maker | NFTX V3 |
| vPUNK | CryptoPunks | NFTX V3 |
| vDEATH | DeathBats | NFTX V3 |

---

## Quick Start

```bash
git clone https://github.com/Aleks-NFT/AgentVault
cd AgentVault/mcp-server
npm install
cp .env.example .env  # add ETH_RPC_URL
npx tsx test-quote.ts
```

**Add to Claude Code / any MCP client:**
```json
{
  "servers": {
    "agentvault": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "/path/to/AgentVault/mcp-server/server.ts"],
      "env": { "ETH_RPC_URL": "https://ethereum-rpc.publicnode.com" }
    }
  }
}
```

---

## Tech Stack

- **MCP Server:** TypeScript, `@modelcontextprotocol/sdk`
- **Price Oracle:** Chainlink ETH/USD Mainnet
- **DEX:** 1inch v6 (USDT↔WETH)
- **NFT Liquidity:** NFTX V3
- **Smart Contracts:** Solidity 0.8.28, Hardhat 3
- **Testnet:** Ethereum Sepolia

---

## Roadmap

- **v2:** Live 1inch execution + Coinbase x402 micropayments
- **v3:** Base/Flayer L2 support (sub-cent gas)
- **v4:** AgentHUB — multi-agent terminal with ERC-8004 trust scores

---

*Built for Synthesis Hackathon 2026 — "Agents that Pay"*
