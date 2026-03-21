import { getEthUsdPrice } from "./chainlink.js";

export interface RouteStep {
  step: number;
  action: string;
  from_token: string;
  to_token: string;
  amount_in: number;
  amount_out: number;
  protocol: string;
  fee_pct: number;
  gas_estimate_usd: number;
}

export interface RouteResult {
  steps: RouteStep[];
  total_gas_usd: number;
  total_fee_pct: number;
  price_impact_pct: number;
}

export interface FeeBreakdown {
  execution_fee_pct: number;
  routing_spread_pct: number;
  total_fee_pct: number;
  execution_fee_usdt: number;
  routing_spread_usdt: number;
  total_fee_usdt: number;
}

export interface GuardResult {
  guard: string;
  passed: boolean;
  value: number;
  threshold: number;
  message: string;
}

// USDT → WETH → vault mint
export async function buildMintRoute(
  amount_usdt: number,
  floor_eth: number,
  premium_pct: number,
  slippage_bps: number = 50
): Promise<RouteResult> {
  const ethPrice = await getEthUsdPrice();
  const slippage_pct = slippage_bps / 10000;

  // Step 1: USDT → WETH via 1inch
  const routing_spread_pct = 0.003; // 0.30%
  const usdt_after_spread = amount_usdt * (1 - routing_spread_pct);
  const weth_received = usdt_after_spread / ethPrice;

  // Step 2: WETH → vault tokens via NFTX
  const execution_fee_pct = 0.0035; // 0.35%
  const vault_price_eth = floor_eth * (1 + premium_pct / 100);
  const weth_after_fee = weth_received * (1 - execution_fee_pct);
  const vault_tokens = weth_after_fee / vault_price_eth;

  const steps: RouteStep[] = [
    {
      step: 1,
      action: "Swap USDT → WETH",
      from_token: "USDT",
      to_token: "WETH",
      amount_in: amount_usdt,
      amount_out: weth_received,
      protocol: "1inch Aggregator",
      fee_pct: routing_spread_pct * 100,
      gas_estimate_usd: 1.2,
    },
    {
      step: 2,
      action: "Mint vault tokens",
      from_token: "WETH",
      to_token: "vToken",
      amount_in: weth_received,
      amount_out: vault_tokens,
      protocol: "NFTX v3",
      fee_pct: execution_fee_pct * 100,
      gas_estimate_usd: 3.8,
    },
  ];

  return {
    steps,
    total_gas_usd: 5.0,
    total_fee_pct: (routing_spread_pct + execution_fee_pct) * 100,
    price_impact_pct: slippage_pct * 100,
  };
}

// vault redeem → WETH → USDT
export async function buildRedeemRoute(
  vault_tokens_in: number,
  floor_eth: number,
  premium_pct: number,
  slippage_bps: number = 50
): Promise<RouteResult> {
  const ethPrice = await getEthUsdPrice();
  const slippage_pct = slippage_bps / 10000;

  // Step 1: vault tokens → WETH via NFTX
  const execution_fee_pct = 0.0035;
  const vault_price_eth = floor_eth * (1 + premium_pct / 100);
  const weth_gross = vault_tokens_in * vault_price_eth;
  const weth_after_fee = weth_gross * (1 - execution_fee_pct);

  // Step 2: WETH → USDT via 1inch
  const routing_spread_pct = 0.003;
  const usdt_out = weth_after_fee * ethPrice * (1 - routing_spread_pct);

  const steps: RouteStep[] = [
    {
      step: 1,
      action: "Redeem vault tokens → WETH",
      from_token: "vToken",
      to_token: "WETH",
      amount_in: vault_tokens_in,
      amount_out: weth_after_fee,
      protocol: "NFTX v3",
      fee_pct: execution_fee_pct * 100,
      gas_estimate_usd: 3.8,
    },
    {
      step: 2,
      action: "Swap WETH → USDT",
      from_token: "WETH",
      to_token: "USDT",
      amount_in: weth_after_fee,
      amount_out: usdt_out,
      protocol: "1inch Aggregator",
      fee_pct: routing_spread_pct * 100,
      gas_estimate_usd: 1.2,
    },
  ];

  return {
    steps,
    total_gas_usd: 5.0,
    total_fee_pct: (routing_spread_pct + execution_fee_pct) * 100,
    price_impact_pct: slippage_pct * 100,
  };
}

export function calcFees(amount_usdt: number): FeeBreakdown {
  const execution_fee_pct = 0.35;
  const routing_spread_pct = 0.30;
  const total_fee_pct = execution_fee_pct + routing_spread_pct;
  return {
    execution_fee_pct,
    routing_spread_pct,
    total_fee_pct,
    execution_fee_usdt: amount_usdt * execution_fee_pct / 100,
    routing_spread_usdt: amount_usdt * routing_spread_pct / 100,
    total_fee_usdt: amount_usdt * total_fee_pct / 100,
  };
}

export function runGuards(
  premium_pct: number,
  price_impact_pct: number,
  max_premium_pct: number = 2.0,
  slippage_bps: number = 50
): GuardResult[] {
  return [
    {
      guard: "premium_check",
      passed: premium_pct <= max_premium_pct,
      value: premium_pct,
      threshold: max_premium_pct,
      message: premium_pct <= max_premium_pct
        ? `Premium ${premium_pct}% within limit`
        : `Premium ${premium_pct}% exceeds max ${max_premium_pct}% — ABORT`,
    },
    {
      guard: "slippage_check",
      passed: price_impact_pct <= slippage_bps / 100,
      value: price_impact_pct,
      threshold: slippage_bps / 100,
      message: price_impact_pct <= slippage_bps / 100
        ? `Slippage ${price_impact_pct}% within limit`
        : `Slippage ${price_impact_pct}% exceeds max — ABORT`,
    },
  ];
}
