# DeDeals Integration — V3 Settlement Layer

## Heritage

DeDeals (originally "Degen Deals") was built at ETHKyiv 2024 as a vertical marketplace protocol where every deal is an NFT with a programmable escrow account (ERC-6551).

**Deployed contracts**: Optimism Mainnet + Base Sepolia
**Repository**: [github.com/Aleks-NFT/DegenDeals](https://github.com/Aleks-NFT/DegenDeals)

The project was ahead of its time — it described tokenized obligations, programmable escrow, factoring, and affiliate networks before the agent economy existed. In February 2026, Ethereum Foundation published ERC-8183 "Agentic Commerce" which validates the same architecture.

## Why DeDeals Matters for AgentVault

AgentVault V1-V2 answers: "How does an agent execute an NFT trade?"
DeDeals V3 answers: "How do agents form agreements around that trade?"

| AgentVault | DeDeals |
|-----------|---------|
| Execution: USDT→NFT→USDT | Settlement: who owes what to whom |
| Single transaction | Multi-party, time-bound contracts |
| Fee on trade | Escrow, KPI, dispute resolution |

## Four Unique Features (not in ERC-8183)

1. **Factoring** — Split a large deal into tradeable fractions
2. **Discount/Bargain** — Seller gets immediate liquidity at discount
3. **Issuer Royalty** — Deal creator earns on secondary transfers
4. **Affiliate Tree** — Agent referral network as tradeable NFTs

## Integration Plan

### Phase 1: Fork & Modernize
- Fork `Degen-Deals/contracts` → `Aleks-NFT/DegenDeals`
- Remove: DeDEAL token, VeDEAL, DAO governance, Web2 legal layer
- Keep: Deal NFT, ERC-6551 escrow, affiliate tree, dispute logic
- Add: ERC-8004 trust adapter (replace SBT-based KYC)

### Phase 2: Agent-First API
- Create DeDeals SKILL.md for LLM agents
- Define 4 deal templates: task escrow, performance contract, revenue share, arb agreement
- Add x402 micropayment layer for deal creation queries

### Phase 3: Connect to AgentVault
- VaultAgent executes trades, DeDeals wraps them in agreements
- AgentHUB monitors deal lifecycle and triggers dispute resolution
- Affiliate NFTs drive agent-to-agent distribution of VaultAgent services

## Deal Templates for Agents

| Template | Obligor | Obligee | Escrow Logic |
|----------|---------|---------|-------------|
| Task Escrow | Employer agent | Worker agent | Release on KPI completion |
| Performance Contract | Trader agent | Investor agent | Release on P&L target |
| Revenue Share | Platform | Affiliate agent | Auto-split on each trade |
| Arb Agreement | Arb bot | Capital provider | Release on profitable exit |
