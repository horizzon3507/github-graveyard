import { AlertTriangle, Hourglass, Loader2, Sprout } from "lucide-react";
import Link from "next/link";
import { StatusBadge, statusFor } from "@/components/graveyard/status-badge";
import { formatReset } from "@/components/graveyard/states";
import { STATUS_META } from "@/analysis/status";
import { thresholds } from "@/config/graveyard";
import { daysBetween, formatNumber, formatYears } from "@/lib/utils";
import type { RepositoryDetail } from "@/database/repository-detail";
import type { RepoAnalysis } from "@/features/repo/analysis-data";

export function StatusBanner({ repo }: { repo: RepositoryDetail }) {
  const now = new Date();
  const days = daysBetween(repo.lastActivityAt, now);
  const status = statusFor(repo.lastActivityAt, repo.archived, now);
  const resurrection = repo.resurrectionsAsOriginal[0];
  const headline = status === "active" ? "Still breathing" : `${STATUS_META[status].label} for ${formatYears(days)}`;
  const tone = status === "active" ? "text-grave-green" : status === "recently_abandoned" ? "text-grave-blue" : status === "fading" ? "text-grave-purple" : status === "ancient" ? "text-grave-amber" : "text-foreground";

  return (
    <div className="surface relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -top-24 right-0 h-48 w-96 rounded-full bg-grave-purple/10 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className={`text-3xl font-semibold tracking-tight sm:text-4xl ${tone}`}>{headline}</p>
          <p className="text-muted-foreground">
            Last maintained <span className="font-mono text-foreground">{formatNumber(days)}</span> days ago.{" "}
            {status === "active" ? "This repository doesn't look abandoned." : `This repository has been quiet for ${formatNumber(days)} days.`}
          </p>
          <p className="text-xs text-muted-foreground/80">{STATUS_META[status].description(thresholds)} Bands are configurable by the instance.</p>
        </div>
        <StatusBadge lastActivityAt={repo.lastActivityAt} archived={repo.archived} resurrected={Boolean(resurrection)} className="text-sm" />
      </div>
      {resurrection && (
        <p className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-sm">
          <Sprout className="size-4 text-grave-green" />
          <strong>This project has been resurrected.</strong>
          <Link href={`/repo/${resurrection.revival.owner}/${resurrection.revival.name}`} className="text-grave-green hover:underline">
            {resurrection.revival.owner}/{resurrection.revival.name}
          </Link>
          is the active continuation.
        </p>
      )}
    </div>
  );
}

export function AnalysisBanner({ analysis }: { analysis: RepoAnalysis | null }) {
  if (!analysis) return null;
  if (analysis.status === "RUNNING" || analysis.status === "PENDING") {
    return (
      <div role="status" className="surface flex items-center gap-3 border-grave-blue/30 px-5 py-4 text-sm">
        <Loader2 className="size-4 shrink-0 animate-spin text-grave-blue" />
        <p>
          <strong>Analysis pending.</strong> <span className="text-muted-foreground">We&apos;re reading commits, releases, issues and forks from GitHub. Scores below are a quick scan; this page updates by itself when the full analysis lands.</span>
        </p>
      </div>
    );
  }
  if (analysis.status === "FAILED") {
    const [code, ...rest] = (analysis.error ?? "failed:").split(":");
    const detail = rest.join(":");
    const message =
      code === "rate_limited" ? `GitHub's API rate limit was reached. The full analysis will retry automatically ${formatReset(detail || null)}.` : code === "not_found" ? detail : "The full analysis could not be completed. It will retry automatically in a few minutes.";
    return (
      <div role="alert" className="surface flex items-start gap-3 border-grave-amber/30 px-5 py-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-grave-amber" />
        <p>
          <strong>{code === "rate_limited" ? "Rate limit reached." : "Analysis incomplete."}</strong> <span className="text-muted-foreground">{message} Showing the quick scan meanwhile.</span>
        </p>
      </div>
    );
  }
  if (analysis.failed.length > 0) {
    return (
      <div role="status" className="surface flex items-start gap-3 border-grave-amber/30 px-5 py-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-grave-amber" />
        <p className="text-muted-foreground">
          <strong className="text-foreground">Partial analysis.</strong> GitHub didn&apos;t answer for: {analysis.failed.join(", ")} (usually the rate limit). Scores use what we have, with lower confidence, and the analysis retries within the hour.
        </p>
      </div>
    );
  }
  if (analysis.depth === "QUICK") {
    return (
      <div role="status" className="surface flex items-center gap-3 px-5 py-4 text-sm">
        <Hourglass className="size-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          <strong className="text-foreground">Quick scan only.</strong> Scores come from repository metadata. The full analysis is queued and will fill in the rest.
        </p>
      </div>
    );
  }
  return null;
}
