import { getEthUsdPrice } from "../providers/chainlink.js";
import { getVaultFloor } from "../providers/nftx.js";
import { buildRedeemRoute, runGuards, calcFees } from "../providers/router.js";
import type { RouteStep, FeeBreakdown, GuardResult } from "../providers/router.js";

export interface RedeemInput {
  vault_id: string;
  vault_tokens_in: number;
  slippage_tolerance_bps?: number;
  max_premium_pct?: number;
  simulate_only?: boolean;
}

export interface RedeemOutput {
  status: "READY" | "SIMULATED" | "ABORTED";
  vault_id: string;
  vault_tokens_in: number;
  eth_usd_price: number;
  usdt_expected: number;
  route_steps: RouteStep[];
  fees: FeeBreakdown;
  effective_rate_pct: number;
  guards: GuardResult[];
  reason: string;
}

export async function redeemToUsdt(input: RedeemInput): Promise<RedeemOutput> {
  const {
    vault_id,
    vault_tokens_in,
    slippage_tolerance_bps = 50,
    max_premium_pct = 2.0,
    simulate_only = true,
  } = input;

  const ethPrice = await getEthUsdPrice();
  const { floor_eth, premium_pct } = await getVaultFloor(vault_id);

  const guards = runGuards(premium_pct, slippage_tolerance_bps / 100, max_premium_pct, slippage_tolerance_bps);
  const failed = guards.find(g => !g.passed);

  const gross_usdt = vault_tokens_in * floor_eth * ethPrice;
  const fees = calcFees(gross_usdt);

  if (failed) {
    return {
      status: "ABORTED",
      vault_id,
      vault_tokens_in,
      eth_usd_price: ethPrice,
      usdt_expected: 0,
      route_steps: [],
      fees,
      effective_rate_pct: 0,
      guards,
      reason: failed.message,
    };
  }

  const route = await buildRedeemRoute(vault_tokens_in, floor_eth, premium_pct, slippage_tolerance_bps);
  const usdt_expected = route.steps[1]?.amount_out ?? 0;

  return {
    status: simulate_only ? "SIMULATED" : "READY",
    vault_id,
    vault_tokens_in,
    eth_usd_price: ethPrice,
    usdt_expected,
    route_steps: route.steps,
    fees,
    effective_rate_pct: fees.total_fee_pct,
    guards,
    reason: simulate_only
      ? `Simulation: ${vault_tokens_in} ${vault_id} tokens → $${usdt_expected.toFixed(2)} USDT. Set simulate_only: false to execute.`
      : `Ready to redeem ${vault_tokens_in} ${vault_id} tokens for $${usdt_expected.toFixed(2)} USDT.`,
  };
}
