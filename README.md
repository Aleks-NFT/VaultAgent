# VaultAgent

**Universal AI execution layer for NFT vault liquidity**

> The first MCP server that gives AI agents safe, verifiable access to $15.96M in locked NFT vault liquidity on Ethereum Mainnet.

## The Problem

NFTX V3 holds **\$15.96M TVL** in live Ethereum contracts. Its UI was shut down January 31, 2026. The liquidity is trapped — no interface, no API, no agentic access.

AI agents have no safe way to move NFT liquidity on-chain: no spend controls, no simulation layer, no verifiable on-chain receipts.

## The Solution

VaultAgent is a 3-layer infrastructure stack:

    Claude / OpenClaw / Any AI Agent
             |  MCP (stdio)
             v
    VaultAgent MCP Server (TypeScript)
      - Intelligence: 7 read/write tools
      - Safety: Policy Engine + simulation
      - Routing: best path across protocols
             |
             v
    VaultAgentFeeWrapper.sol
      - Fee: 0.25% base / 0.10% discounted
      - Guards: maxPremiumBps + pause()
      - Receipts: FeeCollected on every tx
             |
             v
    NFTX V3 Protocol (\$15.96M TVL)

## Autonomous Agent Demo

Full decision loop — no human input required:

    npx ts-node demo/vault-agent-demo.ts

    [STEP 1] discover  -> list_vaults: found PUNK vault, TVL 847 ETH
    [STEP 2] plan      -> get_premium_window: Dutch auction at 2.1%
    [STEP 3] validate  -> simulate_mint: cost 0.08 ETH, policy OK
    [STEP 4] execute   -> execute_mint: TX 0xabc... submitted
    [STEP 5] verify    -> FeeCollected event confirmed on-chain

    Human confirmations required: 0
    Policy guardrails: enforced on-chain

## MCP Tools

### Phase 1 — Read & Simulate (live)

| Tool | Description |
|------|-------------|
| list_vaults | Browse active NFTX vaults with TVL |
| get_vault_info | Vault details: NFT count, fees, vToken address |
| get_premium_window | Dutch auction premium analysis for targeted redeem |
| simulate_mint | Pre-flight: ownership, approval, fee breakdown |

### Phase 2 — Execute (Mainnet live)

| Tool | Description |
|------|-------------|
| execute_mint | Deposit NFT -> vToken via FeeWrapper |
| execute_redeem_targeted | Specific NFT <- vToken + premium with maxPremiumBps guard |
| execute_swap | NFT <-> NFT swap within vault |

## Quick Start

    # OpenClaw skill
    npx skills add Aleks-NFT/VaultAgent

    # From source
    git clone https://github.com/Aleks-NFT/VaultAgent
    cd VaultAgent/packages/mcp-server
    npm install && npm run build
    cp ../../.env.example .env
    npm run dev

## Safety Guardrails

| Layer | Mechanism |
|-------|-----------|
| MCP | Policy Engine: spend limits, simulation required before execute |
| Contract | maxPremiumBps: reverts if premium exceeds threshold |
| Contract | pause() / unpause(): emergency kill-switch |
| Contract | nonReentrant: reentrancy protection on all core functions |

## Fee Model

Base fee: 0.25% (25 bps) on all transactions via FeeWrapper.sol.

Multi-Token Discount (Phase 2.5):

| Token | Threshold | Fee |
|-------|-----------|-----|
| None | - | 0.25% |
| PNKSTR (NFTStrategy.fun) | >= 10,000 | 0.10% |
| DEATHSTR | >= 1,000,000 | 0.10% |

## Deployed Contracts

| Network | Address |
|---------|---------|
| Ethereum Mainnet (verified) | 0xd9f3eddf463a06b89f022e2596f66fc495119f58 |
| Sepolia Testnet (verified) | 0x37d2ab607a2dc81b6c9224767ab234013de8bc28 |

## Ecosystem

**NFTStrategy.fun** — Perpetual NFT Machines. VaultAgent identifies arbitrage windows between NFTStrategy listings (+20% floor) and NFTX vToken prices.

**DeathSTR** — Lists NFTs ~20% below floor every 3 days. VaultAgent snipes discounted listings, mints vTokens, captures the spread atomically.

    DeathSTR lists NFT at -20% floor
        ->
    VaultAgent snipes -> mint vToken in NFTX
        ->
    Sell vToken on AMM -> ~18% profit per tx

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | Done | Read tools + simulation |
| Phase 2A | Done | Mainnet deploy + write tools |
| Phase 2B | Active | Design partners + first on-chain tx |
| Phase 2.5 | Planned | Multi-token fee discount + cross-protocol arb |
| Phase 3 | Planned | OpenClaw distribution + hosted API |
| Phase 4 | Planned | Flayer + Base + B2B SDK |

## Links

- Twitter: @FirstNFT (https://x.com/FirstNFT)
- Telegram: @KyivNFT (https://t.me/KyivNFT)
- Synthesis Hackathon 2026: https://synthesis.md
- ERC-8004 Identity on Base: https://basescan.org/tx/0x2bdad3e271461e3fab36168f7402f33ece90bf6aff9cd5dba5caba3031dc08ff

