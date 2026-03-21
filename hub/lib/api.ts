const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4021";

export interface VaultSignal {
  vault_id: string;
  floor_eth: number;
  floor_usdt: number;
  premium_pct: number;
  arb_opportunity_usdt: number;
  signal: "BUY" | "NEUTRAL" | "EXPENSIVE";
  reason: string;
}

export interface ScanResult {
  eth_usd_price: number;
  scanned_at: string;
  vaults: VaultSignal[];
  best_opportunity: VaultSignal | null;
  summary: string;
}

export async function scanVaults(): Promise<ScanResult> {
  const res = await fetch(`${BASE}/scan/free`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("scan failed");
  return res.json();
}
