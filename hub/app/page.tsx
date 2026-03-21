import { scanVaults } from "@/lib/api";
import { VaultTable } from "@/components/VaultTable";

export const revalidate = 30;

export default async function Home() {
  let data;
  try { data = await scanVaults(); } catch { data = null; }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl font-bold tracking-tight">VaultAgent Console</span>
              <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-400">v0.3.0</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-green-400">● LIVE</span>
            </div>
            <p className="text-zinc-500 text-sm">Stable-denominated NFT execution layer · Base Sepolia</p>
          </div>
          <div className="text-right text-xs text-zinc-600">
            {data ? `Updated ${new Date(data.scanned_at).toLocaleTimeString()}` : "Offline"}
          </div>
        </div>

        {/* Stats */}
        {data && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: "ETH / USD", value: `$${data.eth_usd_price.toLocaleString("en", { maximumFractionDigits: 0 })}` },
              { label: "Best Entry", value: data.best_opportunity ? `${data.best_opportunity.vault_id}` : "—", sub: data.best_opportunity ? `${data.best_opportunity.premium_pct}% premium` : "" },
              { label: "Round-trip Fee", value: "0.65%" },
              { label: "Active Tools", value: "5 MCP" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="text-xs text-zinc-500 mb-1">{label}</div>
                <div className="text-xl font-bold text-white">{value}</div>
                {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Premium Scan</h2>
          {data ? (
            <VaultTable vaults={data.vaults} />
          ) : (
            <div className="rounded-xl border border-zinc-800 p-10 text-center">
              <p className="text-zinc-500 mb-2">MCP server offline</p>
              <code className="text-xs text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded">
                npx tsx mcp-server/http-server.ts
              </code>
            </div>
          )}
        </div>

        {/* Summary bar */}
        {data?.summary && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-400">
            <span className="text-zinc-600 mr-2">↳</span>{data.summary}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-zinc-800/50 text-xs text-zinc-600 flex gap-4">
          <span>Contract: 0xD9F3eDdF...9f58</span>
          <span>·</span>
          <span>x402 Intelligence: $0.001 USDC/query</span>
          <span>·</span>
          <span>SKILL.md available</span>
        </div>

      </div>
    </main>
  );
}
