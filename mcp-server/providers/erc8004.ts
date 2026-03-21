export interface AgentTrustProfile {
  agent_id: string;
  registered: boolean;
  trust_score: number | null;   // 0-100, null если не найден
  uptime_pct: number | null;
  slash_count: number;
  signal: "TRUSTED" | "NEUTRAL" | "LOW_TRUST" | "UNKNOWN";
  profile_url: string;
}

export async function getAgentTrust(agent_id: string): Promise<AgentTrustProfile> {
  const base = "https://8004scan.io/api/agents";
  const profile_url = `https://8004scan.io/agents/${agent_id}`;

  try {
    const res = await fetch(`${base}/${agent_id}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2000), // не блокируем если 8004scan недоступен
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json() as {
      trust_score?: number;
      uptime_pct?: number;
      slash_count?: number;
    };

    const trust_score = data.trust_score ?? null;
    const slash_count = data.slash_count ?? 0;

    const signal =
      trust_score === null ? "UNKNOWN"
      : trust_score >= 75 && slash_count === 0 ? "TRUSTED"
      : trust_score >= 40 ? "NEUTRAL"
      : "LOW_TRUST";

    return {
      agent_id,
      registered: true,
      trust_score,
      uptime_pct: data.uptime_pct ?? null,
      slash_count,
      signal,
      profile_url,
    };
  } catch {
    // 8004scan недоступен или агент не найден — не блокируем, возвращаем UNKNOWN
    return {
      agent_id,
      registered: false,
      trust_score: null,
      uptime_pct: null,
      slash_count: 0,
      signal: "UNKNOWN",
      profile_url,
    };
  }
}
