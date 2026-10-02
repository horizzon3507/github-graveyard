import { cn } from "@/lib/utils";

const TONES = { grave: "#a995ff", revival: "#6ee7a8", gem: "#7aa7ff", community: "#e9c46a" } as const;

export function ScoreRing({ score, size = 72, tone = "grave", label, className }: { score: number | null; size?: number; tone?: keyof typeof TONES; label?: string; className?: string }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = score === null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"}: ${score ?? "not available"} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONES[tone]}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
        />
      </svg>
      <span className="absolute font-mono font-semibold tabular-nums" style={{ fontSize: size * 0.3 }}>
        {score ?? "–"}
      </span>
    </div>
  );
}

export function ScoreBar({ value, tone = "grave", className }: { value: number | null; tone?: keyof typeof TONES; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/7", className)} aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${value ?? 0}%`, background: TONES[tone] }} />
    </div>
  );
}
