# AgentVault Skill

AgentVault is a stablecoin-native execution layer for NFT liquidity.
It lets AI agents quote, simulate and execute USDT→NFT vault operations via NFTX.

## Available Tools

### quote_in_usdt
Get a USDT-denominated price quote before executing a vault operation.
Use this FIRST — always quote before simulating or executing.

**When to use:** "How much does it cost to buy vMILADY with 1000 USDT?"

**Parameters:**
- `vault_id`: "vMILADY" | "vPUNK" | "vDEATH"
- `direction`: "mint" (buy) | "redeem" (sell)
- `amount_usdt`: number (e.g. 1000)
- `slippage_tolerance_bps`: optional, default 50 (0.5%)
- `max_premium_pct`: optional, default 5 (5%)

**Returns:** Live ETH/USD price, fee breakdown, expected vault tokens, route explanation, guards.

---

### simulate_stable_route
Simulate the full step-by-step execution path with gas estimate and policy checks.
Use this SECOND — after quoting, before executing.

**When to use:** "Show me the execution steps for minting vMILADY with 1000 USDT"

**Parameters:**
- `vault_id`: "vMILADY" | "vPUNK" | "vDEATH"
- `direction`: "mint" | "redeem"
- `amount_usdt`: number
- `max_slippage_bps`: optional
- `max_premium_pct`: optional

**Returns:** Step-by-step route (approve→swap→mint), gas estimate in USD,
policy checks (slippage/premium/oracle), PROCEED | WARN | ABORT recommendation.

---

## Standard Flow (explain-before-execute)


## Supported Vaults

| vault_id | Protocol | Asset |
|----------|----------|-------|
| vMILADY  | NFTX v3  | Milady Maker |
| vPUNK    | NFTX v3  | CryptoPunks  |
| vDEATH   | NFTX v3  | DeathBats    |

## Fee Stack

| Fee | Rate |
|-----|------|
| 1inch entry (USDT→WETH) | 0.10% |
| Execution fee | 0.25% |
| Stablecoin convenience | 0.10% |
| 1inch exit (WETH→USDT, redeem only) | 0.10% |
| **Total round-trip** | **~0.45–0.55%** |

## Policy Guards

- Slippage > 50 bps → WARN
- Vault premium > 5% → WARN  
- ETH oracle deviation > 3% → ABORT

## MCP Server

```json
{
  "servers": {
    "agentvault": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "/workspaces/AgentVault/mcp-server/server.ts"],
      "env": { "ETH_RPC_URL": "https://ethereum-rpc.publicnode.com" }
    }
  }
}
```
