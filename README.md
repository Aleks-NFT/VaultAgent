# VaultAgent MCP Server

Agent-native NFT liquidity infrastructure for NFTX protocol

> Phase 1 — Read tools + simulation layer + on-chain FeeWrapper

## Architecture

Claude / AI Agent → MCP (stdio) → VaultAgent MCP Server → NFTX Protocol

## Phase 1 Tools (Read-Only)

- list_vaults — Browse active NFTX vaults
- get_vault_info — Vault details: NFT count, fees, symbol
- get_premium_window — Dutch auction premium analysis
- simulate_mint — Pre-flight check: ownership, approval, fee breakdown

## Phase 2 Tools (Write — requires FeeWrapper deploy)

- execute_mint
- execute_redeem_random
- execute_redeem_targeted
- execute_swap

## Fee Model

VaultAgent fee: 0.25% on all routed transactions
Collected in: ETH
Contract: VaultAgentFeeWrapper.sol

## Contract Addresses (Ethereum Mainnet)

- NFTXVaultFactory: 0xC255335bc5aBd6928063F5788a5E420554858f01
- NFTXFeeDistributorV3: 0x6f25c9B4297f5EBab7c2D00Bec65FE03e62Fe9D3
- VaultAgentFeeWrapper: deploy pending Phase 2
