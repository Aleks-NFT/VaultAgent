import axios from "axios";
const FLOORS: Record<string, { floor_eth: number; premium_pct: number }> = {
  "0x227c7df69d3ed1ae7574a1a7685fded90292eb48": { floor_eth: 2.1, premium_pct: 1.2 },
  "0x269616d549d7e8eaa82dfb17028d0b212d11232a": { floor_eth: 48.5, premium_pct: 0.8 },
  "0x4c7ea15f3b9680f874567b3d5c04f7d776f3c2bc": { floor_eth: 0.8, premium_pct: 2.1 },
};
export async function getVaultFloor(vaultAddress: string): Promise<{ floor_eth: number; premium_pct: number; }> {
  return FLOORS[vaultAddress.toLowerCase()] || { floor_eth: 2.0, premium_pct: 1.0 };
}
