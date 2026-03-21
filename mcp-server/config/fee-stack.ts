export const FEE_STACK = {
  oneinch_entry_bps: 10,
  execution_bps: 25,
  convenience_bps: 10,
  oneinch_exit_bps: 10,
} as const;

export const GUARDS = {
  max_premium_pct_default: 5,
  max_slippage_bps_default: 50,
  max_eth_twap_deviation_pct: 3,
  max_price_impact_bps: 100,
} as const;

export const VAULT_IDS: Record<string, string> = {
  vMILADY: "0x227c7df69d3ed1ae7574a1a7685fded90292eb48",
  vPUNK:   "0x269616d549d7e8eaa82dfb17028d0b212d11232a",
  vDEATH:  "0x4c7ea15f3b9680f874567b3d5c04f7d776f3c2bc",
};

// bps → pct helper
const bps = (v: number) => v / 100;

export function applyFeeStack(amount_usdt: number) {
  const routing_entry_pct  = bps(FEE_STACK.oneinch_entry_bps);   // 0.10%
  const execution_fee_pct  = bps(FEE_STACK.execution_bps);        // 0.25%
  const convenience_pct    = bps(FEE_STACK.convenience_bps);      // 0.10%
  const routing_exit_pct   = bps(FEE_STACK.oneinch_exit_bps);     // 0.10%
  const total_fee_pct      = routing_entry_pct + execution_fee_pct + convenience_pct + routing_exit_pct; // 0.55%

  return {
    routing_entry_pct,
    execution_fee_pct,
    convenience_pct,
    routing_exit_pct,
    total_fee_pct,
    routing_entry_usdt:  amount_usdt * routing_entry_pct  / 100,
    execution_fee_usdt:  amount_usdt * execution_fee_pct  / 100,
    convenience_usdt:    amount_usdt * convenience_pct    / 100,
    routing_exit_usdt:   amount_usdt * routing_exit_pct   / 100,
    total_fee_usdt:      amount_usdt * total_fee_pct      / 100,
  };
}
