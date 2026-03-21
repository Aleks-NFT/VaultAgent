export interface QuoteInput {
  vault_id: string; direction: "mint" | "redeem"; amount_usdt: number;
  slippage_tolerance_bps?: number; max_premium_pct?: number;
}
export interface QuoteOutput {
  status: "ok" | "warning" | "blocked"; direction: "mint" | "redeem"; vault_id: string;
  quote: { input_usdt: number; expected_weth: number; expected_vtokens: number; output_usdt?: number; };
  fees: { oneinch_entry_fee_usdt: number; execution_fee_usdt: number; convenience_fee_usdt: number; oneinch_exit_fee_usdt: number; total_fees_usdt: number; effective_rate_pct: number; };
  market: { eth_usd_price: number; vault_floor_eth: number; vault_floor_usdt: number; vault_premium_pct: number; chainlink_source: string; };
  guards: { slippage_ok: boolean; premium_ok: boolean; price_impact_bps: number; warnings: string[]; };
  route_explanation: string;
}
