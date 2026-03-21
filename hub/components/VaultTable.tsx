import type { VaultSignal } from "@/lib/api";

const signalStyle: Record<string, string> = {
  BUY:       "text-green-400",
  NEUTRAL:   "text-yellow-400",
  EXPENSIVE: "text-red-400",
};

const signalDot: Record<string, string> = {
  BUY:       "bg-green-400",
  NEUTRAL:   "bg-yellow-400",
  EXPENSIVE: "bg-red-400",
};

export function VaultTable({ vaults }: { vaults: VaultSignal[] }) {
  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            <th className="text-left px-4 py-3 text-zinc-400 font-medium">Vault</th>
            <th className="text-right px-4 py-3 text-zinc-400 font-medium">Floor ETH</th>
            <th className="text-right px-4 py-3 text-zinc-400 font-medium">Floor USDT</th>
            <th className="text-right px-4 py-3 text-zinc-400 font-medium">Premium</th>
            <th className="text-right px-4 py-3 text-zinc-400 font-medium">Arb USDT</th>
            <th className="text-center px-4 py-3 text-zinc-400 font-medium">Signal</th>
          </tr>
        </thead>
        <tbody>
          {vaults.map((v) => (
            <tr key={v.vault_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <td className="px-4 py-3 font-mono font-bold text-white">{v.vault_id}</td>
              <td className="px-4 py-3 text-right text-zinc-300 font-mono">{v.floor_eth.toFixed(2)}</td>
              <td className="px-4 py-3 text-right text-zinc-300 font-mono">${v.floor_usdt.toLocaleString("en", { maximumFractionDigits: 0 })}</td>
              <td className={`px-4 py-3 text-right font-mono font-semibold ${signalStyle[v.signal]}`}>{v.premium_pct.toFixed(2)}%</td>
              <td className="px-4 py-3 text-right text-zinc-300 font-mono">${v.arb_opportunity_usdt.toFixed(0)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${signalDot[v.signal]}`} />
                  <span className={`font-semibold text-xs ${signalStyle[v.signal]}`}>{v.signal}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
