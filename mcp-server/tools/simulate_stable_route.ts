import { getEthUsdPrice } from "../providers/chainlink";
import { quoteUsdtToWeth } from "../providers/oneinch";
import { getVaultFloor } from "../providers/nftx";
import { FEE_STACK, GUARDS, VAULT_IDS } from "../config/fee-stack";

export interface SimulateInput {
  vault_id: string;
  direction: "mint" | "redeem";
  amount_usdt: number;
  max_slippage_bps?: number;
  max_premium_pct?: number;
}

export interface SimulateOutput {
  recommendation: "PROCEED" | "WARN" | "ABORT";
  vault_id: string;
  direction: "mint" | "redeem";
  steps: SimulateStep[];
  summary: {
    total_gas_est_usd: number;
    total_fees_usdt: number;
    net_output: string;
    round_trip_cost_pct: number;
    execution_time_est: string;
  };
  policy: {
    slippage_check: "PASS" | "FAIL";
    premium_check: "PASS" | "FAIL";
    oracle_check: "PASS" | "FAIL";
  };
  explanation: string;
}

interface SimulateStep {
  step: number;
  action: string;
  from: string;
  to: string;
  amount: string;
  fee_usdt: number;
  gas_est_usd: number;
  status: "READY" | "WARN" | "SKIP";
}

export async function simulateStableRoute(input: SimulateInput): Promise<SimulateOutput> {
  const {
    vault_id,
    direction,
    amount_usdt,
    max_slippage_bps = GUARDS.max_slippage_bps_default,
    max_premium_pct = GUARDS.max_premium_pct_default,
  } = input;

  const vaultAddress = VAULT_IDS[vault_id];
  if (!vaultAddress) throw new Error(`Unknown vault_id: ${vault_id}`);

  const [ethPrice, oneinchQuote, vaultData] = await Promise.all([
    getEthUsdPrice(),
    quoteUsdtToWeth(amount_usdt),
    getVaultFloor(vaultAddress),
  ]);

  const apply = (bps: number) => (amount_usdt * bps) / 10000;
  const gasPerStep = 0.8; // ~$0.80 per tx on Ethereum mainnet estimate

  const steps: SimulateStep[] = direction === "mint"
    ? [
        {
          step: 1,
          action: "Approve USDT → 1inch Router",
          from: "Wallet",
          to: "1inch v6 Router",
          amount: `${amount_usdt} USDT`,
          fee_usdt: 0,
          gas_est_usd: gasPerStep * 0.4,
          status: "READY",
        },
        {
          step: 2,
          action: "Swap USDT → WETH",
          from: "1inch Router",
          to: "WETH",
          amount: `${oneinchQuote.weth_out.toFixed(6)} WETH`,
          fee_usdt: apply(FEE_STACK.oneinch_entry_bps),
          gas_est_usd: gasPerStep,
          status: "READY",
        },
        {
          step: 3,
          action: "Approve WETH → NFTX Vault",
          from: "Wallet",
          to: "NFTX VaultFactory",
          amount: `${oneinchQuote.weth_out.toFixed(6)} WETH`,
          fee_usdt: 0,
          gas_est_usd: gasPerStep * 0.4,
          status: "READY",
        },
        {
          step: 4,
          action: `Mint ${vault_id} tokens`,
          from: "NFTX Router",
          to: vault_id,
          amount: `${(amount_usdt / (vaultData.floor_eth * ethPrice * (1 + vaultData.premium_pct / 100))).toFixed(4)} ${vault_id}`,
          fee_usdt: apply(FEE_STACK.execution_bps) + apply(FEE_STACK.convenience_bps),
          gas_est_usd: gasPerStep,
          status: vaultData.premium_pct > max_premium_pct ? "WARN" : "READY",
        },
      ]
    : [
        {
          step: 1,
          action: `Approve ${vault_id} → NFTX Router`,
          from: "Wallet",
          to: "NFTX Router",
          amount: `vTokens`,
          fee_usdt: 0,
          gas_est_usd: gasPerStep * 0.4,
          status: "READY",
        },
        {
          step: 2,
          action: `Redeem ${vault_id} → WETH`,
          from: "NFTX Vault",
          to: "WETH",
          amount: `${oneinchQuote.weth_out.toFixed(6)} WETH`,
          fee_usdt: apply(FEE_STACK.execution_bps),
          gas_est_usd: gasPerStep,
          status: "READY",
        },
        {
          step: 3,
          action: "Swap WETH → USDT",
          from: "1inch Router",
          to: "USDT",
          amount: `~${(amount_usdt - apply(FEE_STACK.oneinch_entry_bps + FEE_STACK.execution_bps + FEE_STACK.convenience_bps + FEE_STACK.oneinch_exit_bps)).toFixed(2)} USDT`,
          fee_usdt: apply(FEE_STACK.oneinch_exit_bps) + apply(FEE_STACK.convenience_bps),
          gas_est_usd: gasPerStep,
          status: "READY",
        },
      ];

  const total_fees_usdt = steps.reduce((acc, s) => acc + s.fee_usdt, 0);
  const total_gas_est_usd = steps.reduce((acc, s) => acc + s.gas_est_usd, 0);
  const round_trip_cost_pct = (total_fees_usdt / amount_usdt) * 100;
  const has_warn = steps.some((s) => s.status === "WARN");

  const policy = {
    slippage_check: oneinchQuote.price_impact_bps <= max_slippage_bps ? "PASS" as const : "FAIL" as const,
    premium_check: vaultData.premium_pct <= max_premium_pct ? "PASS" as const : "FAIL" as const,
    oracle_check: ethPrice > 100 ? "PASS" as const : "FAIL" as const,
  };

  const allPass = Object.values(policy).every((v) => v === "PASS");
  const recommendation = !allPass ? "WARN" : has_warn ? "WARN" : "PROCEED";

  const net_output = direction === "mint"
    ? `${(amount_usdt / (vaultData.floor_eth * ethPrice * (1 + vaultData.premium_pct / 100))).toFixed(4)} ${vault_id}`
    : `~${(amount_usdt - total_fees_usdt).toFixed(2)} USDT`;

  const explanation =
    `[${recommendation}] ${direction.toUpperCase()} ${amount_usdt} USDT → ${net_output}. ` +
    `${steps.length} steps, gas ~$${total_gas_est_usd.toFixed(2)}, fees ${total_fees_usdt.toFixed(2)} USDT (${round_trip_cost_pct.toFixed(2)}%). ` +
    `ETH @ $${ethPrice.toFixed(2)} | ${vault_id} floor ${vaultData.floor_eth} ETH | premium ${vaultData.premium_pct}%. ` +
    (recommendation === "PROCEED" ? "✅ All checks passed." : "⚠️ Review warnings before executing.");

  return {
    recommendation,
    vault_id,
    direction,
    steps,
    summary: {
      total_gas_est_usd,
      total_fees_usdt,
      net_output,
      round_trip_cost_pct,
      execution_time_est: `${steps.length * 15}–${steps.length * 30}s`,
    },
    policy,
    explanation,
  };
}
