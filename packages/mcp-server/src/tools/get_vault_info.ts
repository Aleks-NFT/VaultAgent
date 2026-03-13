import { z } from "zod";
import { getAddress, isAddress } from "viem";
import {
  publicClient,
  formatEth,
  formatVToken,
} from "../utils/client.js";
import {
  CONTRACTS,
  VAULT_ABI,
  VAULT_FACTORY_ABI,
  VAULT_AGENT_FEE_BPS,
} from "../abi/contracts.js";

// Schema для валидации входных параметров
export const GetVaultInfoSchema = z.object({
  vault_address: z
    .string()
    .optional()
    .describe("Адрес vault-контракта (0x...)"),
  vault_id: z
    .number()
    .optional()
    .describe("ID vault в реестре NFTXVaultFactory"),
  nft_collection_address: z
    .string()
    .optional()
    .describe("Адрес NFT-коллекции — вернет все vault'ы для этого ассета"),
});

export type GetVaultInfoInput = z.infer<typeof GetVaultInfoSchema>;

export async function getVaultInfo(input: GetVaultInfoInput) {
  let vaultAddress: `0x${string}`;

  // Резолвим адрес vault из разных источников
  if (input.vault_address && isAddress(input.vault_address)) {
    vaultAddress = getAddress(input.vault_address);
  } else if (input.vault_id !== undefined) {
    vaultAddress = (await publicClient.readContract({
      address: CONTRACTS.NFTXVaultFactory,
      abi: VAULT_FACTORY_ABI,
      functionName: "vault",
      args: [BigInt(input.vault_id)],
    })) as `0x${string}`;
  } else if (
    input.nft_collection_address &&
    isAddress(input.nft_collection_address)
  ) {
    const vaults = (await publicClient.readContract({
      address: CONTRACTS.NFTXVaultFactory,
      abi: VAULT_FACTORY_ABI,
      functionName: "vaultsForAsset",
      args: [getAddress(input.nft_collection_address)],
    })) as `0x${string}`[];

    if (vaults.length === 0) {
      return {
        success: false,
        error: "No NFTX vaults found for this NFT collection",
        collection: input.nft_collection_address,
      };
    }

    // Если несколько vault'ов — возвращаем список
    if (vaults.length > 1) {
      return {
        success: true,
        message: `Found ${vaults.length} vaults for this collection. Use vault_address to query specific one.`,
        vaults,
      };
    }

    vaultAddress = vaults[0];
  } else {
    return {
      success: false,
      error:
        "Provide vault_address, vault_id, or nft_collection_address",
    };
  }

  // Читаем данные vault параллельно
  const [name, symbol, totalSupply, vaultFees, vaultId] =
    await Promise.all([
      publicClient.readContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: "name",
      }),
      publicClient.readContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: "symbol",
      }),
      publicClient.readContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: "totalSupply",
      }),
      publicClient.readContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: "vaultFees",
      }),
      publicClient.readContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: "vaultId",
      }),
    ]);

  const fees = vaultFees as [bigint, bigint, bigint];
  const supply = totalSupply as bigint;

  // Считаем нашу VaultAgent fee поверх mint fee
  const mintFeeBase = fees[0];
  const vaultAgentFeeOnMint = (mintFeeBase * BigInt(VAULT_AGENT_FEE_BPS)) / BigInt(10_000);

  return {
    success: true,
    vault: {
      address: vaultAddress,
      id: Number(vaultId),
      name,
      symbol,
      // vTokens в обращении = число NFT в vault (1:1 соотношение)
      nfts_in_vault: formatVToken(supply as bigint, symbol as string, 0),
      total_supply_raw: supply.toString(),
    },
    fees: {
      // Комиссии NFTX (в долях от 1e18, т.е. 0.05e18 = 5%)
      mint_fee_bps: Number(fees[0]) / 1e14, // конвертируем в basis points
      redeem_fee_bps: Number(fees[1]) / 1e14,
      swap_fee_bps: Number(fees[2]) / 1e14,
    },
    vault_agent_fee: {
      additional_bps: VAULT_AGENT_FEE_BPS,
      description: `VaultAgent adds ${VAULT_AGENT_FEE_BPS / 100}% on top of NFTX fees for routing, simulation, and safety layer`,
    },
    links: {
      etherscan: `https://etherscan.io/address/${vaultAddress}`,
      nftx_analytics: `https://dune.com/nftx`,
    },
  };
}
