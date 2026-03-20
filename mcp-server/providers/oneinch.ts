import axios from "axios";
export async function quoteUsdtToWeth(amountUsdt: number): Promise<{ weth_out: number; price_impact_bps: number; }> {
  const { data } = await axios.get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", { timeout: 8000 });
  const ethPrice = data.ethereum.usd as number;
  return { weth_out: amountUsdt / ethPrice, price_impact_bps: Math.round((amountUsdt / 1000000) * 10) };
}
