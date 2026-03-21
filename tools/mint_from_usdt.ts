import { getEthUsdPrice } from "../providers/chainlink.js";
import { getVaultFloor } from "../providers/nftx.js";
import { buildMintRoute, runGuards, calcFees } from "../providers/router.js";
import type { RouteStep, FeeBreakdown, GuardResult } from "../providers/router.js";
import { getAgentTrust } from "../providers/erc8004.js";
import type { AgentTrustProfile } from "../providers/erc8004.js";

export interface MintInput {
  vault_id: string;
  amount_usdt: number;
  slippage_tolerance_bps?: number;
  max_premium_pct?: number;
  simulate_only?: boolean;
  agent_id?: string;
}

export interface MintOutput {
  status: "READY" | "SIMULATED" | "ABORTED";
  vault_id: string;
  amount_usdt_in: number;
  eth_usd_price: number;
  amount_eth: number;
  vault_tokens_expected: number;
  route_steps: RouteStep[];
  fees: FeeBreakdown;
  effective_rate_pct: number;
  guards: GuardResult[];
  reason: string;
  agent_trust: AgentTrustProfile;
}

export async function mintFromUsdt(input: MintInput): Promise<MintOutput> {
  const {
    vault_id,
    amount_usdt,
    slippage_tolerance_bps = 50,
    max_premium_pct = 2.0,
    simulate_only = true,
    agent_id = "anonymous",
  } = input;

  const agent_trust = await getAgentTrust(agent_id);

  const ethPrice = await getEthUsdPrice();
  const { floor_eth, premium_pct } = await getVaultFloor(vault_id);

  const guards = runGuards(premium_pct, slippage_tolerance_bps / 100, max_premium_pct, slippage_tolerance_bps);
  const failed = guards.find(g => !g.passed);

  if (failed) {
    return {
      status: "ABORTED",
      vault_id,
      amount_usdt_in: amount_usdt,
      eth_usd_price: ethPrice,
      amount_eth: 0,
      vault_tokens_expected: 0,
      route_steps: [],
      fees: calcFees(amount_usdt),
      effective_rate_pct: 0,
      guards,
      reason: failed.message,
      agent_trust,
    };
  }

  const route = await buildMintRoute(amount_usdt, floor_eth, premium_pct, slippage_tolerance_bps);
  const fees = calcFees(amount_usdt);
  const vault_tokens_expected = route.steps[1]?.amount_out ?? 0;
  const amount_eth = route.steps[0]?.amount_out ?? 0;

  return {
    status: simulate_only ? "SIMULATED" : "READY",
    vault_id,
    amount_usdt_in: amount_usdt,
    eth_usd_price: ethPrice,
    amount_eth,
    vault_tokens_expected,
    route_steps: route.steps,
    fees,
    effective_rate_pct: fees.total_fee_pct,
    guards,
    agent_trust,
    reason: simulate_only
      ? `Simulation complete. ${vault_tokens_expected.toFixed(4)} vault tokens for $${amount_usdt} USDT. Set simulate_only: false to execute.`
      : `Ready to execute mint of ${vault_tokens_expected.toFixed(4)} ${vault_id} tokens.`,
  };
}
