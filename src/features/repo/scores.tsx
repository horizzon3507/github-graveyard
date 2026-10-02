import { Info } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "@/components/graveyard/score-ring";
import type { FactorResult } from "@/types/analysis";
import type { RepoAnalysis } from "@/features/repo/analysis-data";
import { cn } from "@/lib/utils";

function Factors({ factors, tone }: { factors: FactorResult[]; tone: "grave" | "revival" }) {
  const color = tone === "grave" ? "#a995ff" : "#6ee7a8";
  return (
    <details className="group mt-4 border-t border-border pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:text-grave-green [&::-webkit-details-marker]:hidden">
        Show the {factors.length} factors behind this score
        <span className="transition-transform group-open:rotate-90" aria-hidden="true">›</span>
      </summary>
      <ul className="mt-3 grid gap-3">
        {factors.map((f) => (
          <li key={f.key} className={cn("grid gap-1.5", !f.available && "opacity-60")}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{f.label}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {f.available ? `+${f.points.toFixed(1)}` : "n/a"} <span className="text-muted-foreground/60">· weight {f.weight}</span>
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/7">
              <div className="h-full rounded-full" style={{ width: `${(f.value ?? 0) * 100}%`, background: color }} />
            </div>
            <p className="text-xs text-muted-foreground">{f.detail}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ScoreCard({ title, score, confidence, tone, caption, factors }: { title: string; score: number; confidence: number; tone: "grave" | "revival"; caption: string; factors: FactorResult[] }) {
  return (
    <div className="surface p-5">
      <div className="flex items-center gap-5">
        <ScoreRing score={score} size={84} tone={tone} label={title} />
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          <p className="text-sm text-muted-foreground">{caption}</p>
          <Badge variant={confidence >= 80 ? "green" : confidence >= 50 ? "amber" : "muted"} title="Share of the score's factor weight that had data">
            {confidence}% confidence
          </Badge>
        </div>
      </div>
      <Factors factors={factors} tone={tone} />
    </div>
  );
}

export function ScoresSection({ analysis }: { analysis: RepoAnalysis }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2">
        <ScoreCard title="Grave Score" score={analysis.graveScore} confidence={analysis.graveConfidence} tone="grave" caption="How abandoned it looks. Higher means more abandoned." factors={analysis.graveFactors} />
        <ScoreCard title="Revival Score" score={analysis.revivalScore} confidence={analysis.revivalConfidence} tone="revival" caption="How promising a revival looks. Higher means more potential." factors={analysis.revivalFactors} />
      </div>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Both scores are calculated by GitHub Graveyard from public data. They are estimates to help you decide, not absolute truth. <Link href="/methodology" className="text-grave-green hover:underline">Read the formulas</Link>.
        </span>
      </p>
    </div>
  );
}
