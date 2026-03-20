import { getEthUsdPrice } from "../providers/chainlink";
import { getVaultFloor } from "../providers/nftx";
import { VAULT_IDS } from "../config/fee-stack";

export interface PremiumScanInput {
  max_premium_pct?: number;
  min_arb_usdt?: number;
}

export interface VaultPremiumData {
  vault_id: string;
  floor_eth: number;
  floor_usdt: number;
  premium_pct: number;
  arb_opportunity_usdt: number;
  signal: "BUY" | "NEUTRAL" | "EXPENSIVE";
  reason: string;
}

export interface PremiumScanOutput {
  eth_usd_price: number;
  scanned_at: string;
  vaults: VaultPremiumData[];
  best_opportunity: VaultPremiumData | null;
  summary: string;
}

export async function scanPremiumInUsd(input: PremiumScanInput = {}): Promise<PremiumScanOutput> {
  const { max_premium_pct = 2.0, min_arb_usdt = 50 } = input;

  const ethPrice = await getEthUsdPrice();

  const vaultIds = Object.keys(VAULT_IDS);
  const vaults: VaultPremiumData[] = await Promise.all(
    vaultIds.map(async (vault_id) => {
      const address = VAULT_IDS[vault_id];
      const { floor_eth, premium_pct } = await getVaultFloor(address);

      const floor_usdt = floor_eth * ethPrice;
      const fair_value_usdt = floor_usdt;
      const current_price_usdt = floor_usdt * (1 + premium_pct / 100);
      const arb_opportunity_usdt = current_price_usdt - fair_value_usdt;

      let signal: "BUY" | "NEUTRAL" | "EXPENSIVE";
      let reason: string;

      if (premium_pct === 0) {
        signal = "BUY";
        reason = `Zero premium — floor price, optimal entry. Save ${arb_opportunity_usdt.toFixed(0)} USDT vs targeted redeem.`;
      } else if (premium_pct <= max_premium_pct) {
        signal = "NEUTRAL";
        reason = `Premium ${premium_pct}% within threshold (${max_premium_pct}%). Acceptable entry.`;
      } else {
        signal = "EXPENSIVE";
        reason = `Premium ${premium_pct}% exceeds threshold. Overpaying ~${arb_opportunity_usdt.toFixed(0)} USDT vs floor.`;
      }

      return { vault_id, floor_eth, floor_usdt, premium_pct, arb_opportunity_usdt, signal, reason };
    })
  );

  const opportunities = vaults
    .filter(v => v.signal === "BUY" || (v.signal === "NEUTRAL" && v.arb_opportunity_usdt >= min_arb_usdt))
    .sort((a, b) => a.premium_pct - b.premium_pct);

  const best_opportunity = opportunities[0] ?? null;

  const buyCount = vaults.filter(v => v.signal === "BUY").length;
  const expensiveCount = vaults.filter(v => v.signal === "EXPENSIVE").length;

  const summary = best_opportunity
    ? `Best entry: ${best_opportunity.vault_id} @ ${best_opportunity.premium_pct}% premium ($${best_opportunity.floor_usdt.toFixed(0)} USDT floor). ` +
      `${buyCount} BUY / ${vaults.length - buyCount - expensiveCount} NEUTRAL / ${expensiveCount} EXPENSIVE signals.`
    : `No optimal entry found. All vaults above ${max_premium_pct}% threshold. Wait for premium compression.`;

  return {
    eth_usd_price: ethPrice,
    scanned_at: new Date().toISOString(),
    vaults,
    best_opportunity,
    summary,
  };
}
