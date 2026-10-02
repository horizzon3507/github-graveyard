import { AlertCircle, Check, Heart, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RepoAnalysis } from "@/features/repo/analysis-data";

export function WhyAbandoned({ analysis }: { analysis: RepoAnalysis }) {
  return (
    <ul className="surface grid gap-3 p-5">
      {analysis.abandonmentSignals.map((s) => (
        <li key={s.key} className="flex items-start gap-3 text-sm">
          {s.severity === "low" ? <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <AlertCircle className={cn("mt-0.5 size-4 shrink-0", s.severity === "high" ? "text-grave-purple" : "text-grave-blue")} />}
          <span>{s.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function CommunityAlive({ analysis }: { analysis: RepoAnalysis }) {
  const incomplete = analysis.failed.includes("issues");
  const positive = analysis.communitySignals.filter((s) => s.positive);
  return (
    <div className="surface space-y-4 p-5">
      <p className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Heart className={cn("size-5", positive.length > 0 ? "text-grave-green" : "text-muted-foreground")} />
        {positive.length > 0 ? "This grave isn't completely silent." : "Nobody is knocking."}
      </p>
      {incomplete && <p className="text-xs text-grave-amber">Issues could not be fetched from GitHub (usually the rate limit), so this section may understate demand.</p>}
      <ul className="grid gap-2.5">
        {analysis.communitySignals.map((s) => (
          <li key={s.key} className="flex items-start gap-3 text-sm">
            {s.positive ? <Check className="mt-0.5 size-4 shrink-0 text-grave-green" /> : <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
            <span>{s.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
