import { getEthUsdPrice } from "../providers/chainlink.js";
import { getVaultFloor } from "../providers/nftx.js";
import { buildMintRoute } from "../providers/router.js";
import { applyFeeStack } from "../config/fee-stack.js";
import type { RouteStep, FeeBreakdown, GuardResult } from "../providers/router.js";

export interface MintInput {
  vault_id: string;
  amount_usdt: number;
  slippage_tolerance_bps?: number;
  max_premium_pct?: number;
  simulate_only?: boolean;
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
}

// ... types
