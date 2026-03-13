import { createPublicClient, createWalletClient, http, Chain } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const RPC_URL = process.env.ETH_RPC_URL ?? "https://eth.llamarpc.com";

// Read-only клиент — для всех GET операций (get_vault_info, get_premium, etc.)
export const publicClient = createPublicClient({
  chain: mainnet as Chain,
  transport: http(RPC_URL),
});

// Write клиент — только если задан приватный ключ (для агентных действий)
export function getWalletClient() {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) {
    throw new Error(
      "AGENT_PRIVATE_KEY not set. Write operations require a configured wallet."
    );
  }
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    account,
    chain: mainnet as Chain,
    transport: http(RPC_URL),
  });
}

// Форматирование ETH значений
export function formatEth(wei: bigint, decimals = 6): string {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(decimals) + " ETH";
}

// Форматирование vToken значений (тоже 18 decimals)
export function formatVToken(amount: bigint, symbol: string, decimals = 4): string {
  const val = Number(amount) / 1e18;
  return val.toFixed(decimals) + " " + symbol;
}

// Конвертация basis points → множитель
export function applyFeeBps(amount: bigint, feeBps: number): bigint {
  return (amount * BigInt(feeBps)) / BigInt(10_000);
}
