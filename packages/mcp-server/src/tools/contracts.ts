// NFTX V3 Contract Addresses (Ethereum Mainnet)
export const CONTRACTS = {
  NFTXVaultFactory: "0xC255335bc5aBd6928063F5788a5E420554858f01",
  NFTXFeeDistributorV3: "0x6f25c9B4297f5EBab7c2D00Bec65FE03e62Fe9D3",
  NFTXInventoryStakingV3: "0x889f313d1F20f43C7a6CcB14e12628Ba1E78C9E0",
  MarketplaceZap: "0x789C968f48E0f5C77c7D6f57A0D4D64E25db3Ad4",
  // VaultAgent Fee Wrapper (deploy address — заполняется после деплоя)
  FeeWrapper: process.env.FEE_WRAPPER_ADDRESS ?? "0x0000000000000000000000000000000000000000",
} as const;

// Наша комиссия поверх NFTX
export const VAULT_AGENT_FEE_BPS = 25; // 0.25% = 25 basis points
export const VAULT_AGENT_FEE_RECIPIENT = process.env.FEE_RECIPIENT ?? "0x0000000000000000000000000000000000000000";

// ABI: NFTXVaultFactory — поиск и информация о vaults
export const VAULT_FACTORY_ABI = [
  {
    name: "vaultsForAsset",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    name: "vault",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "vaultId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "numVaults",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allVaults",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
] as const;

// ABI: NFTXVaultUpgradeableV3 — основная логика vault
export const VAULT_ABI = [
  // Информация о vault
  {
    name: "vaultId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "assetAddress",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "vaultFees",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "mintFee", type: "uint256" },
      { name: "redeemFee", type: "uint256" },
      { name: "swapFee", type: "uint256" },
    ],
  },
  {
    name: "allValidNFTs",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenIds", type: "uint256[]" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // Premium fee для targeted redeem (Голландский аукцион)
  {
    name: "premiumPrice",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "ethPrice", type: "uint256" },
    ],
    outputs: [{ name: "premium", type: "uint256" }],
  },
  // Mint: депозит NFT → vToken
  {
    name: "mint",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "tokenIds", type: "uint256[]" },
      { name: "amounts", type: "uint256[]" }, // для ERC-1155, для ERC-721 = []
    ],
    outputs: [{ name: "vTokensMinted", type: "uint256" }],
  },
  // Random redeem: vToken → случайный NFT
  {
    name: "redeem",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "numNFTs", type: "uint256" },
      { name: "specificIds", type: "uint256[]" }, // [] = random
      { name: "wethAmount", type: "uint256" },
      { name: "forceFees", type: "bool" },
    ],
    outputs: [{ name: "redeemedIds", type: "uint256[]" }],
  },
  // Swap: свой NFT → другой NFT из vault
  {
    name: "swap",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "tokenIds", type: "uint256[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "specificIds", type: "uint256[]" },
      { name: "wethAmount", type: "uint256" },
      { name: "forceFees", type: "bool" },
    ],
    outputs: [{ name: "swappedIds", type: "uint256[]" }],
  },
  // ERC-20 (vToken) данные
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ABI: ERC-721 (NFT) — проверка ownership и approve
export const ERC721_ABI = [
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "isApprovedForAll",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "setApprovalForAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const;
