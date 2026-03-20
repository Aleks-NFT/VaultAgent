# AgentVault — Roadmap

## V1: Execution Engine ✅ COMPLETE

**Timeline**: Q1 2026
**Status**: Deployed on Sepolia + Ethereum Mainnet

Delivered:
- VaultAgentFeeWrapper.sol — routes mint/redeem/swap through NFTX V3
- MCP Server with 7 tools (4 read + 3 write)
- SKILL.md for progressive disclosure to LLM agents
- Simulate → Confirm → Execute safety pattern
- 0.25% execution fee, pause/unpause, maxPremiumBps guard

## V2: Stable Rail 🔨 BUILDING NOW (Synthesis Hackathon)

**Timeline**: March 2026
**Deadline**: March 25, 2026

### Week of March 20-25 (Final Sprint)

- [ ] **Day 1-2**: StableVaultRouter.sol contract
  - depositStableAndMint(vaultId, amountUSDT, minNFTOut)
  - redeemToStable(vaultId, tokenIds, minUSDTOut)
  - Chainlink ETH/USD oracle integration
  - 1inch aggregator router for USDT↔WETH
  - Collection whitelist

- [ ] **Day 2-3**: MCP Server V2
  - quote_in_usdt — show all prices in USD
  - simulate_stable — full route preview with fee breakdown
  - mint_from_usdt — USDT→WETH→mint flow
  - redeem_to_usdt — redeem→WETH→USDT flow
  - scan_premium_usd — arb scanner in USD terms

- [ ] **Day 3-4**: ERC-8004 Integration
  - Register AgentVault via npx create-8004-agent on Base
  - Trust-gate: check agent reputation before allowing execution
  - agent-card.json with capabilities

- [ ] **Day 4-5**: Demo & Submission
  - AgentVault Console (lite UI) — execution logs, route preview
  - End-to-end demo scenario
  - Updated SKILL.md v2
  - Submission to Synthesis

### Key Metrics for Hackathon
- Take-rate: 0.65% base (pessimistic 0.50% / optimistic 0.85%)
- Target demo: 1 complete USDT→NFT→USDT round-trip on Base
- One agent-to-agent scenario using ERC-8004 discovery

## V3: Settlement Layer 📋 Q2 2026

- DeDeals Protocol integration (Deal NFTs + ERC-6551 escrow)
- Agent employment contracts
- Affiliate NFT distribution network
- Reputation-aware routing via 8004scan webhooks
- ERC-8183 compatibility layer

## V4: Platform 📋 Q3-Q4 2026

- Full AgentHUB terminal (Academy + Corporation)
- Flayer adapter (Uniswap V4 hooks) on Base
- Multi-chain expansion (Base, Arbitrum, Monad)
- DCA subscriptions for non-crypto users
- DAO treasury management product ($999-2,999/mo B2B)
- Hosted API tier ($99-499/mo)
