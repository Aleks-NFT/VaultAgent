# VaultAgent MCP Server

**First execution-grade agent interface for NFT liquidity.**

> Simulate → Confirm → Execute.
> Starting with NFTX. Ready for Flayer. Built for the Agentic Web.

---

## Architecture

```
Claude / OpenClaw / ElizaOS / Any MCP-compatible agent
         │
         ▼  MCP (stdio)
VaultAgent MCP Server (TypeScript)
         │
         ├── list_vaults          → browse active NFT vaults
         ├── get_vault_info       → vault details + fee breakdown
         ├── get_premium_window   → Dutch auction analysis
         ├── simulate_mint        → pre-flight ownership + fee check
         │
         ├── execute_mint         → NFT → vToken  ⚠️ write
         ├── execute_redeem       → vToken → NFT  ⚠️ write
         └── execute_swap         → NFT ↔ NFT     ⚠️ write
         │
         ▼  on-chain (0.25% fee)
VaultAgentFeeWrapper.sol
         │
         ▼
NFTX V3  →  Flayer (coming)  →  ...
```

## Tools

### Phase 1 — Read (live on mainnet)

| Tool | Description |
|------|-------------|
| `list_vaults` | Browse active NFTX vaults (PUNK, MILADY, BAYC, etc.) |
| `get_vault_info` | Vault details: NFT count, fees, vToken symbol |
| `get_premium_window` | Dutch auction premium analysis for targeted redeem |
| `simulate_mint` | Pre-flight check: ownership, approval, fee breakdown |

### Phase 2 — Write (requires FeeWrapper deploy + `FEE_WRAPPER_ADDRESS`)

| Tool | Description |
|------|-------------|
| `execute_mint` | Deposit NFT → vToken via FeeWrapper |
| `execute_redeem` | Random or targeted NFT ← vToken (with `maxPremiumBps` guard) |
| `execute_swap` | NFT ↔ NFT swap within vault |

Write tools follow a mandatory **Simulate → Confirm → Execute** pattern.
Setting `confirmed=false` always returns `AWAITING_CONFIRMATION` — never executes.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env: set ETH_RPC_URL (and FEE_WRAPPER_ADDRESS for write tools)
npm run dev
```

## Claude Desktop Integration

```json
{
  "mcpServers": {
    "vaultagent-nftx": {
      "command": "node",
      "args": ["/path/to/VaultAgent/packages/mcp-server/dist/index.js"],
      "env": {
        "ETH_RPC_URL": "https://eth.llamarpc.com",
        "FEE_WRAPPER_ADDRESS": "0x..."
      }
    }
  }
}
```

## Contract

`VaultAgentFeeWrapper.sol` — routes mint/redeem/swap through NFTX V3, collects 0.25% fee.

**v1.1 changes:**
- `pause()` / `unpause()` emergency kill-switch (owner only)
- `maxPremiumBps` parameter in `redeem()` — on-chain slippage guard
- `whenNotPaused` modifier on all write functions

| Network | Address | Status |
|---------|---------|--------|
| Sepolia (testnet) | `0x37d2ab607a2dc81b6c9224767ab234013de8bc28` | ✅ Verified |
| Ethereum Mainnet | *deploy pending — Phase 2A* | ⏳ |

## Fee Model

- **VaultAgent fee:** 0.25% (25 bps) on all routed transactions
- **Adjustable:** 0–1% range, owner-controlled
- **Kill-switch:** `pause()` halts all write operations instantly

## NFTX V3 Contracts (Ethereum Mainnet)

| Contract | Address |
|----------|---------|
| NFTXVaultFactory | `0xC255335bc5aBd6928063F5788a5E420554858f01` |
| NFTXFeeDistributorV3 | `0x6f25c9B4297f5EBab7c2D00Bec65FE03e62Fe9D3` |

## Roadmap

- [x] Phase 1 — Testnet: MCP server + FeeWrapper on Sepolia
- [ ] Phase 2A — Mainnet Read-Only: deploy + first public announcement
- [ ] Phase 2B — Gated Write: execute tools + design partners
- [ ] Phase 2C — Public Write: open access
- [ ] Phase 3 — SKILL.md + Hosted API ($99–499/mo, x402/USDC)
- [ ] Phase 4 — Flayer adapter + Base + B2B SDK

---

Built by [@FirstNFT](https://twitter.com/FirstNFT)
