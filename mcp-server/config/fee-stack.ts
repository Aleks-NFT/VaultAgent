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
