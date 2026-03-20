# AgentVault

[![GitHub stars](https://img.shields.io/github/stars/Aleks-NFT/AgentVault?style=flat-square)](https://github.com/Aleks-NFT/AgentVault/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://github.com/Aleks-NFT/AgentVault/blob/main/LICENSE)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue?style=flat-square)](https://modelcontextprotocol.io)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-integrated-orange?style=flat-square)](https://8004scan.io)
[![Synthesis](https://img.shields.io/badge/Synthesis-2026-green?style=flat-square)](https://synthesis.md)

**Stablecoin-native execution infrastructure for the agentic economy.**

> Agents think in dollars. NFT markets speak ETH.
> AgentVault translates.

---

## What is AgentVault?

AgentVault is a three-layer protocol that lets AI agents safely interact with NFT liquidity using stablecoins (USDT/USDC), without manual ETH management:

```
┌─────────────────────────────────────────────────┐
│  Layer 3: AgentHUB Console (UI & AgentOps)      │
│  ─ monitor, approve/deny, alerting, trust gate  │
├─────────────────────────────────────────────────┤
│  Layer 2: Stable Rail (V2 — Hackathon MVP)      │
│  ─ USDT quote, simulate, execute, settle        │
│  ─ MCP Server + x402 micropayments              │
│  ─ ERC-8004 identity + trust-aware routing       │
├─────────────────────────────────────────────────┤
│  Layer 1: Execution Engine (V1 — Live)          │
│  ─ VaultAgentFeeWrapper.sol (0.25% fee)         │
│  ─ NFTX V3 mint / redeem / swap                 │
│  ─ Deployed on Sepolia + Mainnet                │
└─────────────────────────────────────────────────┘
```

---

## Evolution

This project grew from a single NFTX interface into a full execution stack for the agentic economy:

| Phase | What | Status |
|-------|------|--------|
| **V1** — VaultAgent | NFTX execution engine + MCP Server + FeeWrapper contract | ✅ Live (Sepolia + Mainnet) |
| **V2** — AgentVault Stable Rail | USDT-denominated operations + ERC-8004 trust + x402 payments | 🔨 Building (Synthesis hackathon) |
| **V3** — AgentVault + DeDeals | Settlement layer: Deal NFTs, escrow, agent employment, affiliate network | 📋 Roadmap |

> **Heritage**: V3 settlement layer is powered by [DegenDeals Protocol](https://github.com/Aleks-NFT/DegenDeals) — our 2024 ETHKyiv project (deployed on Optimism Mainnet), now repurposed for agent-to-agent commerce. See [DeDeals Integration](docs/DEDEALS-INTEGRATION.md).

---

## Architecture

```
Claude / OpenClaw / ElizaOS / Any MCP-compatible agent
         │
         ▼  MCP (stdio) + x402 micropayments ($0.001/query)
AgentVault MCP Server (TypeScript)
         │
    ┌────┴────────────────────────────────┐
    │         V2: Stable Rail              │
    │                                      │
    │  quote_in_usdt     → USD price       │
    │  simulate_stable   → route preview   │
    │  mint_from_usdt    → USDT→WETH→NFT   │
    │  redeem_to_usdt    → NFT→WETH→USDT   │
    │  scan_premium_usd  → arb scanner     │
    │  settle_to_stable  → net settlement  │
    │                                      │
    │  Policy Engine:                      │
    │  ├── Chainlink ETH/USD oracle guard  │
    │  ├── maxSlippage / maxPremium caps   │
    │  ├── Collection whitelist            │
    │  └── ERC-8004 trust-gate             │
    └────┬────────────────────────────────┘
         │
    ┌────┴────────────────────────────────┐
    │         V1: Execution Engine         │
    │                                      │
    │  list_vaults       → browse vaults   │
    │  get_vault_info    → details + fees  │
    │  get_premium_window → Dutch auction  │
    │  simulate_mint     → pre-flight      │
    │  execute_mint      → NFT → vToken    │
    │  execute_redeem    → vToken → NFT    │
    │  execute_swap      → NFT ↔ NFT      │
    └────┬────────────────────────────────┘
         │
         ▼  on-chain
    VaultAgentFeeWrapper.sol (0.25% fee)
    StableVaultRouter.sol   (V2 — stable rail)
         │
         ▼
    NFTX V3  →  Flayer (coming)  →  ...
```

---

## Three Operating Modes

| Mode | What happens | Best for |
|------|-------------|----------|
| **USD Quote Mode** | Show all prices in USDT. No execution. | Discovery, dashboards, B2B API |
| **Stable Entry/Exit** | Accept USDT → convert → execute → return USDT | Retail one-shot, DAO treasury |
| **Netted Agent Mode** | Agent holds WETH working balance, settles in USDT periodically | Frequent traders, arb bots |

---

## Fee Model

| Fee | Amount | Description |
|-----|--------|-------------|
| AgentVault execution | 0.25% (25 bps) | Auto-collected by FeeWrapper |
| Integrator fee (DEX) | 0.10-0.15% | 1inch/LI.FI routing |
| Stable convenience | 0.10% | USD abstraction layer |
| NFTX protocol | 0.5-2% | Vault-dependent, passed through |
| **Total round-trip** | **~0.60-0.75%** | Conservative estimate |

> Intelligence layer (x402): $0.001 USDC per API query for simulation/quotes.
> Execution layer (smart contract): % fee on actual trades.

---

## Deployed Contracts

| Network | Contract | Address | Status |
|---------|----------|---------|--------|
| Sepolia | VaultAgentFeeWrapper (V1) | [`0x37d2ab...`](https://sepolia.etherscan.io/address/0x37d2ab607a2dc81b6c9224767ab234013de8bc28) | ✅ Verified |
| Mainnet | VaultAgentFeeWrapper (V1) | [`0xd9f3ed...`](https://etherscan.io/address/0xd9f3eddf463a06b89f022e2596f66fc495119f58) | ✅ Verified |
| Base | StableVaultRouter (V2) | TBD | 🔨 Building |

---

## Quick Start

```bash
git clone https://github.com/Aleks-NFT/AgentVault.git
cd AgentVault
npm install
cp .env.example .env
# Edit .env: set ETH_RPC_URL
npm run dev
```

### Install as Agent Skill

```bash
npx skillsadd Aleks-NFT/AgentVault
```

Or copy `skills/vault-agent/SKILL.md` to your agent's skills directory.

Works with: Claude Code, Cursor, Windsurf, Cline, GitHub Copilot, Codex CLI, Goose, OpenClaw, ElizaOS, and 12+ MCP-compatible agents.

---

## ERC-8004 Integration

AgentVault uses ERC-8004 as its identity and trust backbone:

- **Identity**: Registered as an agent on Base via `npx create-8004-agent`
- **Trust-gating**: Incoming agents checked against 8004scan 7-dimension trust score
- **Discovery**: Listed in global agent registry (97K+ agents)
- **Payments**: x402 micropayments for API access ($0.001 USDC/query)

---

## Roadmap

### V2 — Synthesis Hackathon (March 2026) ← WE ARE HERE
- [ ] StableVaultRouter.sol on Base
- [ ] Stable Rail MCP tools (quote_in_usdt, mint_from_usdt, redeem_to_usdt)
- [ ] ERC-8004 agent registration + trust-gate
- [ ] AgentVault Console (lite monitoring UI)
- [ ] x402 micropayments for intelligence layer
- [ ] SKILL.md v2 with stable-denominated operations

### V3 — Settlement Layer (Q2 2026)
- [ ] DeDeals Protocol integration (Deal NFTs + ERC-6551 escrow)
- [ ] Agent employment contracts (hire/escrow/KPI/dispute)
- [ ] Affiliate NFT network for B2B agent distribution
- [ ] Reputation-aware routing via 8004scan

### V4 — Platform (Q3 2026)
- [ ] Full AgentHUB terminal (Academy + Corporation + marketplace)
- [ ] Flayer adapter (Uniswap V4) + multi-chain
- [ ] DCA subscriptions for non-crypto users
- [ ] DAO treasury automation

---

## Repository Structure

```
AgentVault/
├── contracts/
│   ├── v1/
│   │   └── VaultAgentFeeWrapper.sol       # V1 — deployed, verified
│   └── v2/
│       └── StableVaultRouter.sol          # V2 — Synthesis hackathon
├── packages/
│   └── mcp-server/                        # MCP server (TypeScript)
├── skills/
│   └── vault-agent/
│       └── SKILL.md                       # Agent skill (progressive disclosure)
├── docs/
│   ├── ARCHITECTURE.md                    # Full technical architecture
│   ├── ROADMAP.md                         # Detailed roadmap
│   └── DEDEALS-INTEGRATION.md             # V3 settlement layer plan
├── scripts/
├── test/
├── .env.example
├── hardhat.config.ts
├── package.json
└── README.md                              # ← You are here
```

---

## The Thesis

98.6% of AI agent payments are in USDC ([Circle, March 2026](https://www.circle.com)).
NFT infrastructure still speaks ETH.

AgentVault bridges this gap: **stablecoin-native execution for NFT liquidity**, built for agents, accessible to humans.

- **V1** gave agents hands (execution)
- **V2** gives agents a wallet that speaks their language (stablecoins)
- **V3** gives agents contracts and employment (settlement)

---

## Links

- 🐦 Twitter: [@FirstNFT](https://twitter.com/FirstNFT)
- 💬 Telegram: [NFTxAI UNITED PEOPLE](https://t.me/KyivNFT)
- 📰 News: [NFT Times](https://t.me/NFTtimes)
- 🏗️ DeDeals (V3 Heritage): [github.com/Aleks-NFT/DegenDeals](https://github.com/Aleks-NFT/DegenDeals)
- 🔍 Hackathon: [The Synthesis](https://synthesis.md)

---

Built by [@FirstNFT](https://twitter.com/FirstNFT) | First NFT Agency
