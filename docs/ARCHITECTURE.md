# AgentVault — Technical Architecture

## System Overview

AgentVault is a three-layer execution protocol for AI agents interacting with NFT liquidity through stablecoins.

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT LAYER                                 │
│  Claude / OpenClaw / ElizaOS / Ottie / Any MCP agent            │
│  Reads SKILL.md → generates requests → pays via x402             │
└───────────────────────┬─────────────────────────────────────────┘
                        │ MCP (stdio) + x402 ($0.001 USDC/query)
┌───────────────────────▼─────────────────────────────────────────┐
│                 AGENTVAULT MCP SERVER                            │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Intelligence  │  │  Policy      │  │  ERC-8004            │   │
│  │ Layer         │  │  Engine      │  │  Trust Gate          │   │
│  │               │  │              │  │                      │   │
│  │ • quote_usdt  │  │ • maxSlip    │  │ • resolve identity   │   │
│  │ • simulate    │  │ • maxPremium │  │ • check trust score  │   │
│  │ • scan_arb    │  │ • whitelist  │  │ • assign policy tier │   │
│  │ • explain     │  │ • oracle     │  │ • webhook alerts     │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         └────────┬────────┘                      │               │
│                  ▼                                │               │
│  ┌──────────────────────────────┐                │               │
│  │    Stable Rail Router        │◄───────────────┘               │
│  │                              │                                │
│  │  USD Quote Mode:             │                                │
│  │    Show prices in USDT       │                                │
│  │    No execution              │                                │
│  │                              │                                │
│  │  Stable Entry/Exit Mode:     │                                │
│  │    USDT→WETH→NFT→WETH→USDT  │                                │
│  │    Full round-trip           │                                │
│  │                              │                                │
│  │  Netted Agent Mode:          │                                │
│  │    Hold WETH working balance │                                │
│  │    Settle to USDT on exit    │                                │
│  └──────────────┬───────────────┘                                │
└─────────────────┼────────────────────────────────────────────────┘
                  │ on-chain transactions
┌─────────────────▼────────────────────────────────────────────────┐
│                 SMART CONTRACT LAYER                              │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐  │
│  │ VaultAgentFeeWrapper  │  │ StableVaultRouter (V2)           │  │
│  │ (V1 — deployed)       │  │                                  │  │
│  │                       │  │ • depositStableAndMint()         │  │
│  │ • mint()              │  │ • redeemToStable()               │  │
│  │ • redeem()            │  │ • batchSettle()                  │  │
│  │ • swap()              │  │ • Chainlink ETH/USD oracle       │  │
│  │ • 0.25% fee           │  │ • 1inch/LI.FI aggregator        │  │
│  │ • pause/unpause       │  │ • maxSlippage guard              │  │
│  │ • maxPremiumBps       │  │ • collection whitelist           │  │
│  └──────────┬───────────┘  └──────────────┬───────────────────┘  │
│             └──────────┬──────────────────┘                      │
└────────────────────────┼─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│                 PROTOCOL LAYER                                    │
│                                                                  │
│  NFTX V3 (Ethereum)  │  Flayer (Base, coming)  │  Future...      │
│  1inch / LI.FI       │  Chainlink Oracles      │  Uniswap V4     │
└──────────────────────────────────────────────────────────────────┘
```

## Use Case Matrix

| Scenario | Mode | Stable In? | Stable Out? | Revenue |
|----------|------|-----------|------------|---------|
| Retail one-shot mint | Stable Entry/Exit | ✅ USDT→WETH | ✅ N/A (holds NFT) | 0.60% |
| Retail one-shot redeem | Stable Entry/Exit | N/A | ✅ WETH→USDT | 0.60% |
| Agent arb (frequent) | Netted Agent | First entry only | Settlement only | 0.25% per op |
| DAO treasury allocation | Stable Entry/Exit | ✅ USDC→WETH | ✅ yields→USDC | 0.65% + SaaS |
| DCA subscription | Stable Entry/Exit | ✅ monthly USDT | Optional | 0.65% + $15-49/mo |

## ERC-8004 Integration Architecture

```
Agent requests access to AgentVault
         │
         ▼
[1] Resolve ERC-8004 identity (8004scan API)
    → chain presence, capabilities, DID
         │
         ▼
[2] Read reputation signals
    → feedback score, validator attestations
    → uptime, domain verification, star count
         │
         ▼
[3] Assign policy tier
    ├── Tier 0: Read-only (quotes, simulation)
    ├── Tier 1: Low-risk execution (small amounts)
    ├── Tier 2: Capital-enabled (full execution)
    └── Tier 3: Escrow-only (DeDeals settlement)
         │
         ▼
[4] Subscribe to webhook events
    → validation.completed, feedback.received
    → Auto-update trust score, revoke if needed
```

## V3 Vision: DeDeals Settlement Layer

```
AgentVault (execution)
    + DeDeals Protocol (settlement)
    + ERC-8004 (trust)
    = Agent Commerce Stack

Deal NFT (ERC-721) + Escrow Account (ERC-6551)
    │
    ├── Agent Employment: hire bot, set KPI, escrow payment
    ├── Factoring: split large deal into tradeable fractions
    ├── Affiliate Tree: agent referral network with revenue share
    └── Dispute: evaluator role resolves conflicts on-chain
```

## Security Model

- **Simulate → Confirm → Execute**: All write operations require explicit confirmation
- **Chainlink oracle guard**: ETH/USD TWAP prevents execution during flash spikes
- **Collection whitelist**: On-chain registry of approved NFT collections
- **maxSlippage / maxPremium**: On-chain caps prevent overpaying
- **ERC-8004 trust-gate**: Unknown agents restricted to read-only
- **Pause mechanism**: Owner can emergency-halt all write operations
