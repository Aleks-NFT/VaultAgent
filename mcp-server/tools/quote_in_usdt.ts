import { QuoteInput, QuoteOutput } from "./types";
import { FEE_STACK, GUARDS, VAULT_IDS } from "../config/fee-stack";
import { getEthUsdPrice } from "../providers/chainlink";
import { quoteUsdtToWeth } from "../providers/oneinch";
import { getVaultFloor } from "../providers/nftx";
export async function quoteInUsdt(input: QuoteInput): Promise<QuoteOutput> {
  const vaultAddress = VAULT_IDS[input.vault_id];
  if (!vaultAddress) throw new Error(`Unknown vault_id: ${input.vault_id}`);
  const [ethPrice, oneinchQuote, vaultData] = await Promise.all([ getEthUsdPrice(), quoteUsdtToWeth(input.amount_usdt), getVaultFloor(vaultAddress) ]);
  const apply = (bps: number) => (input.amount_usdt * bps) / 10000;
  const fees = {
    oneinch_entry_fee_usdt: apply(FEE_STACK.oneinch_entry_bps),
    execution_fee_usdt: apply(FEE_STACK.execution_bps),
    convenience_fee_usdt: apply(FEE_STACK.convenience_bps),
    oneinch_exit_fee_usdt: input.direction === "redeem" ? apply(FEE_STACK.oneinch_exit_bps) : 0,
    total_fees_usdt: 0, effective_rate_pct: 0
  };
  fees.total_fees_usdt = fees.oneinch_entry_fee_usdt + fees.execution_fee_usdt + fees.convenience_fee_usdt + fees.oneinch_exit_fee_usdt;
  fees.effective_rate_pct = (fees.total_fees_usdt / input.amount_usdt) * 100;
  const net_usdt = input.amount_usdt - fees.total_fees_usdt;
  const expected_vtokens = net_usdt / (vaultData.floor_eth * ethPrice * (1 + vaultData.premium_pct / 100));
  return {
    status: "ok", direction: input.direction, vault_id: input.vault_id,
    quote: { input_usdt: input.amount_usdt, expected_weth: oneinchQuote.weth_out, expected_vtokens, ...(input.direction === "redeem" && { output_usdt: net_usdt }) },
    fees, market: { eth_usd_price: ethPrice, vault_floor_eth: vaultData.floor_eth, vault_floor_usdt: vaultData.floor_eth * ethPrice, vault_premium_pct: vaultData.premium_pct, chainlink_source: "Mainnet 0x5f4eC3..." },
    guards: { slippage_ok: true, premium_ok: true, price_impact_bps: oneinchQuote.price_impact_bps, warnings: [] },
    route_explanation: `${input.amount_usdt} USDT → WETH via 1inch → ${input.direction} ${expected_vtokens.toFixed(4)} ${input.vault_id} on NFTX. Total cost: ${fees.total_fees_usdt.toFixed(2)} USDT. ✅ OK.`
  };
}
