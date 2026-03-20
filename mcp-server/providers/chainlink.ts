import axios from "axios";
export async function getEthUsdPrice(): Promise<number> {
  const rpc = process.env.ETH_RPC_URL || "https://ethereum-rpc.publicnode.com";
  const { data } = await axios.post(rpc, {
    jsonrpc: "2.0", id: 1, method: "eth_call",
    params: [{ to: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", data: "0x50d25bcd" }, "latest"]
  });
  return Number(BigInt(data.result)) / 1e8;
}
