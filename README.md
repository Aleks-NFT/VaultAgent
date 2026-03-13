# VaultAgent MCP Server

[![GitHub stars](https://img.shields.io/github/stars/Aleks-NFT/VaultAgent?style=flat-square)](https://github.com/Aleks-NFT/VaultAgent/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue?style=flat-square)](https://modelcontextprotocol.io)
[![NFTX](https://img.shields.io/badge/NFTX-V3-purple?style=flat-square)](https://nftx.io)
[![Sepolia](https://img.shields.io/badge/Sepolia-verified-green?style=flat-square)](https://sepolia.etherscan.io/address/0x37d2ab607a2dc81b6c9224767ab234013de8bc28)

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
         ├── get_premium_window   → Dutch auction premium analysis
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

---

## Tools

### Phase 1 — Read (live)

| Tool | Description |
|------|-------------|
| `list_vaults` | Browse active NFTX vaults (PUNK, MILADY, BAYC, AZUKI, etc.) |
| `get_vault_info` | Vault details: NFT count, fees, vToken symbol |
| `get_premium_window` | Dutch auction premium analysis for targeted redeem |
| `simulate_mint` | Pre-flight check: ownership, approval, fee breakdown |

### Phase 2 — Write (requires `FEE_WRAPPER_ADDRESS`)

| Tool | Description |
|------|-------------|
| `execute_mint` | Deposit NFT → vToken via FeeWrapper |
| `execute_redeem` | Random or targeted NFT ← vToken (with `maxPremiumBps` guard) |
| `execute_swap` | NFT ↔ NFT swap within vault |

All write tools enforce **Simulate → Confirm → Execute**.  
`confirmed=false` always returns `AWAITING_CONFIRMATION`. Never executes without user approval.

---

## Quick Start

```bash
git clone https://github.com/Aleks-NFT/VaultAgent.git
cd VaultAgent
npm install
cp .env.example .env
# Edit .env: set ETH_RPC_URL
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

## Install as Agent Skill

```bash
npx skillsadd Aleks-NFT/VaultAgent
```

Or copy `skills/vault-agent/SKILL.md` to `.claude/skills/` in your project.

Works with: Claude Code, Cursor, Windsurf, Cline, GitHub Copilot, Codex CLI, Goose, and 12+ other MCP-compatible agents.

---

## Contract

`VaultAgentFeeWrapper.sol` — routes mint/redeem/swap through NFTX V3, collects 0.25% fee.

**v1.1 features:**
- `pause()` / `unpause()` emergency kill-switch (owner only)
- `maxPremiumBps` parameter in `redeem()` — on-chain slippage guard
- `whenNotPaused` modifier on all write functions

| Network | Address | Status |
|---------|---------|--------|
| Sepolia | [`0x37d2ab...`](https://sepolia.etherscan.io/address/0x37d2ab607a2dc81b6c9224767ab234013de8bc28) | ✅ Verified |
| Mainnet | [`0xd9f3eddf...`](https://etherscan.io/address/0xd9f3eddf463a06b89f022e2596f66fc495119f58) | ✅ Verified |

## Fee Model

| Fee | Amount | Who pays |
|-----|--------|----------|
| VaultAgent | 0.25% (25 bps) | User, auto-collected by FeeWrapper |
| NFTX protocol | 0.5–2% (vault-dependent) | User, passed to NFTX |
| ETH premium | Dutch auction (0–500%) | User, only for targeted redeems |

---

## Roadmap

- [x] Phase 1 — Testnet: MCP server + FeeWrapper on Sepolia
- [x] Phase 2A — Mainnet Read-Only: deploy + first public announcement
- [ ] Phase 2B — Gated Write: execute tools + design partners
- [ ] Phase 2C — Public Write: open access
- [ ] Phase 3 — SKILL.md distribution + Hosted API ($99–499/mo, x402/USDC)
- [ ] Phase 4 — Flayer adapter (Uniswap V4) + Base + B2B SDK

---

Built by [@FirstNFT](https://twitter.com/FirstNFT)
