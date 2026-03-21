type Signal = "TRUSTED" | "NEUTRAL" | "LOW_TRUST" | "UNKNOWN";

const styles: Record<Signal, string> = {
  TRUSTED:   "bg-green-500/20 text-green-400 border-green-500/30",
  NEUTRAL:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  LOW_TRUST: "bg-red-500/20 text-red-400 border-red-500/30",
  UNKNOWN:   "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

export function TrustBadge({ signal, score }: { signal: Signal; score: number | null }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${styles[signal]}`}>
      {signal} {score !== null ? `· ${score}` : ""}
    </span>
  );
}
