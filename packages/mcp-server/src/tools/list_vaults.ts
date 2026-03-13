import { z } from "zod";
import { publicClient, formatVToken } from "../utils/client.js";
import { CONTRACTS, VAULT_FACTORY_ABI, VAULT_ABI } from "../abi/contracts.js";

export const ListVaultsSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .describe("Количество vault'ов для отображения"),
  offset: z.number().default(0).describe("Смещение для пагинации"),
});

export type ListVaultsInput = z.infer<typeof ListVaultsSchema>;

// Топ коллекции для быстрого доступа (hardcoded для скорости MVP)
const KNOWN_VAULTS: Record<string, { name: string; symbol: string; address: string }> = {
  "CryptoPunks": {
    name: "CryptoPunks",
    symbol: "PUNK",
    address: "0x269616D549D7e8Eaa82DFb17028d0B212D11232A",
  },
  "Milady Maker": {
    name: "Milady Maker",
    symbol: "MILADY",
    address: "0x227c7DF69D3ed1ae7574A1a7685fDEd90292EB48",
  },
  "Azuki": {
    name: "Azuki",
    symbol: "AZUKI",
    address: "0xFAFf15C6cDAca61a4F87D329689293E07c98f578",
  },
  "Pudgy Penguins": {
    name: "Pudgy Penguins",
    symbol: "PUDGY",
    address: "0x37BE7e6B3bC3aF7e4b5329beC0F47Aad1E7d40b",
  },
  "Bored Ape Yacht Club": {
    name: "Bored Ape Yacht Club",
    symbol: "BAYC",
    address: "0xEA97f1CfCe28de37c0B1B0B6E5ecB79FBE1C038",
  },
};

export async function listVaults(input: ListVaultsInput) {
  try {
    // Получаем общее количество vault'ов
    const numVaults = await publicClient.readContract({
      address: CONTRACTS.NFTXVaultFactory,
      abi: VAULT_FACTORY_ABI,
      functionName: "numVaults",
    });

    const totalVaults = Number(numVaults);
    const { limit, offset } = input;

    // Для MVP возвращаем known vaults + статистику
    const knownVaultEntries = Object.entries(KNOWN_VAULTS).slice(
      offset,
      offset + limit
    );

    // Параллельно получаем totalSupply для каждого known vault
    const vaultDetails = await Promise.all(
      knownVaultEntries.map(async ([collection, info]) => {
        try {
          const [totalSupply, vaultFees] = await Promise.all([
            publicClient.readContract({
              address: info.address as `0x${string}`,
              abi: VAULT_ABI,
              functionName: "totalSupply",
            }),
            publicClient.readContract({
              address: info.address as `0x${string}`,
              abi: VAULT_ABI,
              functionName: "vaultFees",
            }),
          ]);

          const fees = vaultFees as [bigint, bigint, bigint];
          const supply = totalSupply as bigint;

          return {
            collection,
            address: info.address,
            symbol: info.symbol,
            nfts_in_vault: Number(supply / BigInt(10 ** 18)),
            fees: {
              mint_bps: Number(fees[0]) / 1e14,
              redeem_bps: Number(fees[1]) / 1e14,
              swap_bps: Number(fees[2]) / 1e14,
            },
            links: {
              etherscan: `https://etherscan.io/address/${info.address}`,
            },
          };
        } catch {
          return {
            collection,
            address: info.address,
            symbol: info.symbol,
            error: "Could not fetch live data",
          };
        }
      })
    );

    return {
      success: true,
      total_vaults_in_protocol: totalVaults,
      showing: vaultDetails.length,
      vaults: vaultDetails,
      note:
        "Showing known major vaults. Use get_vault_info with specific address for any vault.",
      pagination: {
        offset,
        limit,
        has_more: offset + limit < Object.keys(KNOWN_VAULTS).length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch vaults: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
