import { z } from "zod";
import { getAddress, isAddress } from "viem";
import { publicClient, formatEth } from "../utils/client.js";
import { VAULT_ABI, VAULT_AGENT_FEE_BPS } from "../abi/contracts.js";

export const GetPremiumWindowSchema = z.object({
  vault_address: z.string().describe("Адрес NFTX vault"),
  token_ids: z
    .array(z.number())
    .describe("Список tokenId NFT для проверки premium"),
  eth_price_wei: z
    .string()
    .optional()
    .describe(
      "Текущая цена 1 vToken в ETH (в wei). Если не указано — используем оценку по floor"
    ),
});

export type GetPremiumWindowInput = z.infer<typeof GetPremiumWindowSchema>;

// Максимальная premium = 500% (5x) за 0 часов, падает до 0% за 10 часов
const MAX_PREMIUM_BPS = 50000; // 500%
const PREMIUM_DECAY_HOURS = 10;

export async function getPremiumWindow(input: GetPremiumWindowInput) {
  if (!isAddress(input.vault_address)) {
    return { success: false, error: "Invalid vault_address" };
  }

  const vaultAddr = getAddress(input.vault_address);

  // Получаем symbol для читаемого вывода
  const symbol = await publicClient.readContract({
    address: vaultAddr,
    abi: VAULT_ABI,
    functionName: "symbol",
  });

  // Базовая цена: если не передана — считаем 1 vToken = 1 ETH как placeholder
  // В продакшне нужно тянуть из Uniswap V3 TWAP
  const ethPriceWei = input.eth_price_wei
    ? BigInt(input.eth_price_wei)
    : BigInt("1000000000000000000"); // 1 ETH

  const premiumResults = await Promise.all(
    input.token_ids.map(async (tokenId) => {
      try {
        const premium = (await publicClient.readContract({
          address: vaultAddr,
          abi: VAULT_ABI,
          functionName: "premiumPrice",
          args: [BigInt(tokenId), ethPriceWei],
        })) as bigint;

        const premiumEth = Number(premium) / 1e18;
        const totalCostEth = Number(ethPriceWei) / 1e18 + premiumEth;

        // Оцениваем когда premium упадет до нуля
        const premiumRatio = Number(premium) / Number(ethPriceWei);
        const hoursUntilZero = premiumRatio > 0
          ? Math.min(
              (premiumRatio / 5) * PREMIUM_DECAY_HOURS,
              PREMIUM_DECAY_HOURS
            )
          : 0;

        // VaultAgent fee поверх
        const vaultAgentFeeWei =
          (BigInt(totalCostEth * 1e18) * BigInt(VAULT_AGENT_FEE_BPS)) /
          BigInt(10_000);

        return {
          token_id: tokenId,
          premium_eth: premiumEth.toFixed(6),
          premium_percent: (premiumRatio * 100).toFixed(2) + "%",
          vtokens_base_cost: (Number(ethPriceWei) / 1e18).toFixed(6),
          total_cost_eth: totalCostEth.toFixed(6),
          vault_agent_fee_eth: (Number(vaultAgentFeeWei) / 1e18).toFixed(6),
          grand_total_eth: (
            totalCostEth +
            Number(vaultAgentFeeWei) / 1e18
          ).toFixed(6),
          recommendation:
            premiumRatio > 2
              ? "⚠️ HIGH PREMIUM — wait or use random redeem"
              : premiumRatio > 0.5
              ? "🟡 MODERATE — consider waiting ~" +
                hoursUntilZero.toFixed(1) +
                " hours"
              : premiumRatio > 0
              ? "🟢 LOW PREMIUM — good time to redeem"
              : "✅ NO PREMIUM — optimal redeem window",
          hours_until_zero: hoursUntilZero.toFixed(1),
        };
      } catch (err) {
        return {
          token_id: tokenId,
          error: "Could not fetch premium — token may not be in vault",
        };
      }
    })
  );

  return {
    success: true,
    vault: vaultAddr,
    symbol,
    premium_analysis: premiumResults,
    context: {
      max_premium: "500% (5x vToken price) — decays to 0% over 10 hours",
      premium_distribution: "90% → original depositor, 10% → NFTX protocol",
      strategy_tip:
        "VaultAgent monitors premium windows and can alert you when a target NFT drops below your threshold",
    },
  };
}
