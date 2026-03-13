---
name: vault-agent
description: >
  Execute NFT vault liquidity operations via NFTX protocol.
  Simulate, analyze, and execute mint/redeem/swap on NFTX V3 vaults
  with built-in fee calculation and safety checks.
version: 1.0.0
author: Aleks-NFT
repo: https://github.com/Aleks-NFT/VaultAgent
tags: [nftx, nft, liquidity, vault, redeem, mint, swap, web3, defi, ethereum, on-chain, blockchain]
agents: [claude-code, cursor, windsurf, cline, copilot, codex, goose]
---

# VaultAgent Skill

VaultAgent gives AI agents execution-grade access to NFT vault liquidity on NFTX V3.
Every write operation follows a mandatory **Simulate → Confirm → Execute** pattern —
the agent shows the user a full cost breakdown and waits for explicit confirmation
before touching any on-chain transaction.

## Use when

- User asks to check NFT vault liquidity, browse NFTX vaults, or find vault TVL
- User wants to know the floor price or vToken value of an NFT collection
- User asks about premium windows or Dutch auction timing for targeted NFT redemption
- User wants to simulate depositing NFTs into a vault (mint) before committing
- User wants to execute mint, redeem (random or targeted), or swap on NFTX
- User asks "how much does it cost to get my NFT back from NFTX?"
- User asks about VaultAgent fees or NFTX fee structure
- Any query about NFTX vaults: MILADY, PUNK, BAYC, AZUKI, or other collections

## Do NOT use when

- User asks about NFT prices on OpenSea, Blur, or other marketplaces (not NFTX)
- User asks about staking, farming, or LP positions on NFTX
- User asks about NFT minting (creating new NFTs, not NFTX vault deposits)

## Tools

### Read tools (always available)

| Tool | When to use |
|------|-------------|
| `list_vaults` | First step — discover active vaults for a collection |
| `get_vault_info` | Get fees, NFT count, vToken info for a specific vault |
| `get_premium_window` | Before targeted redeem — check Dutch auction premium and timing |
| `simulate_mint` | Pre-flight check before execute_mint |

### Write tools (requires FEE_WRAPPER_ADDRESS in env)

| Tool | When to use |
|------|-------------|
| `execute_mint` | Deposit NFTs → vTokens. Always simulate first. |
| `execute_redeem` | Redeem vTokens → NFTs (random or targeted). Use get_premium_window first for targeted. |
| `execute_swap` | Swap specific NFTs for other NFTs in same vault. |

## Instructions

### Mandatory workflow for all write operations

```
1. Read  → list_vaults / get_vault_info / get_premium_window / simulate_mint
2. Show  → present the full cost breakdown to the user clearly:
           - What goes in (NFT tokenIds or vToken amount)
           - What comes out (vTokens or NFT)
           - NFTX protocol fee
           - VaultAgent fee (0.25%)
           - ETH premium (for targeted redeems)
           - Gas estimate
3. Ask   → "Confirm [mint/redeem/swap]?" — explicit yes/no from user
4. Execute → call execute_* with confirmed=true ONLY after user says yes
```

**Never set `confirmed=true` without explicit user approval in the same conversation turn.**
If `confirmed=false`, the tool returns `AWAITING_CONFIRMATION` — this is correct and expected.

### Premium window for targeted redeems

NFTX V3 uses a Dutch auction for targeted redeems:
- Premium starts at **500%** when an NFT is deposited
- Decays to **0%** over **10 hours**
- Always call `get_premium_window` before a targeted redeem
- If premium > 20%, recommend the user wait unless they need the specific token urgently
- Pass the premium ETH value as `eth_premium_wei` to `execute_redeem`
- Always set `max_premium_bps` (recommended: 2000 = 20%) to protect against price spikes

### Fee structure

Every transaction through VaultAgent:
- **NFTX protocol fee:** varies by vault (typically 0.5–2%)
- **VaultAgent fee:** 0.25% (25 bps), collected automatically by FeeWrapper contract
- **ETH premium:** only for targeted redeems, paid to vault depositor

### Error handling

| Error | What to do |
|-------|------------|
| `AWAITING_CONFIRMATION` | Normal — show to user, ask for confirmation |
| `APPROVAL_REQUIRED` | User must approve NFT or vToken spending. Explain which contract to approve. |
| `BLOCKED` / `paused: true` | Contract paused by owner. Do not retry. Inform user. |
| `Insufficient vToken balance` | User needs more vTokens. Show required vs available. |
| `premium exceeds max` | Current premium too high. Show get_premium_window result. |

## Examples

### Example 1: Check vault liquidity

```
User: "How many Milady NFTs are in NFTX right now?"

Agent workflow:
1. list_vaults() → find MILADY vault
2. get_vault_info(vault_address: "0x...milady...") → show NFT count, fees, vToken price
3. Reply with: vault name, NFTs locked, current fees, vToken symbol (MILADY)
```

### Example 2: Simulate mint (deposit)

```
User: "I want to deposit Milady #1234 into NFTX. What will I get?"

Agent workflow:
1. list_vaults() → find MILADY vault address
2. simulate_mint(vault_address, token_ids: [1234], owner_address: "0x...user...") 
3. Show result:
   - You will receive: ~0.9975 MILADY vTokens (after 0.25% VaultAgent fee)
   - NFTX mint fee: X%
   - Approval needed: Yes/No
   - Ready to execute: Yes/No
4. Ask: "Want me to execute this mint?"
```

### Example 3: Targeted redeem with premium check

```
User: "Get me Milady #5678 back from NFTX"

Agent workflow:
1. list_vaults() → MILADY vault address
2. get_premium_window(vault_address, token_ids: [5678]) → check Dutch auction
3. If premium > 20%: "Current premium is 45% (~0.45 ETH extra). 
   It will drop to ~15% in 3.2 hours. Wait or proceed?"
4. User: "Proceed"
5. execute_redeem(vault_address, num_nfts: 1, specific_ids: [5678],
   vtoken_amount: "1000000000000000000",
   eth_premium_wei: "450000000000000000",
   max_premium_bps: 5000,
   owner_address: "0x...",
   confirmed: false)  ← first show AWAITING_CONFIRMATION
6. Show cost breakdown to user, ask "Confirm?"
7. User: "Yes"
8. execute_redeem(..., confirmed: true) → execute on-chain
```

### Example 4: Random redeem

```
User: "Redeem 1 random Azuki from NFTX vault"

Agent workflow:
1. list_vaults() → AZUKI vault
2. execute_redeem(vault_address, num_nfts: 1, specific_ids: [],
   vtoken_amount: "1000000000000000000",  
   confirmed: false)
3. Show: cost breakdown, ask "Confirm?"
4. execute_redeem(..., confirmed: true)
```
