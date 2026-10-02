import Link from "next/link";
import { CircleDot, GitFork, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/graveyard/status-badge";
import { LanguageDot } from "@/components/graveyard/language-dot";
import { ScoreBar } from "@/components/graveyard/score-ring";
import { formatAgo, formatCompact, formatYears, daysBetween } from "@/lib/utils";
import type { RepositoryCard } from "@/database/repository-queries";

export function RepoCard({ repo }: { repo: RepositoryCard }) {
  const now = new Date();
  return (
    <Link
      href={`/repo/${repo.owner}/${repo.name}`}
      className="surface group flex h-full flex-col gap-4 p-5 outline-none transition-colors hover:border-white/20 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="space-y-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{repo.owner}</p>
          <h3 className="truncate text-[15px] font-semibold tracking-tight group-hover:text-grave-green">{repo.name}</h3>
        </div>
        <StatusBadge lastActivityAt={repo.lastActivityAt} archived={repo.archived} resurrected={repo.resurrected} />
      </div>

      <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{repo.description ?? "No description provided."}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <LanguageDot language={repo.language} />
        <span className="inline-flex items-center gap-1" title="Stars">
          <Star className="size-3.5" /> {formatCompact(repo.stars)}
        </span>
        <span className="inline-flex items-center gap-1" title="Forks">
          <GitFork className="size-3.5" /> {formatCompact(repo.forks)}
        </span>
        <span className="inline-flex items-center gap-1" title="Open issues and pull requests">
          <CircleDot className="size-3.5" /> {formatCompact(repo.openIssues)}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <dt className="text-muted-foreground/70">{repo.lastCommitAt ? "Last commit" : "Last push"}</dt>
          <dd>{formatAgo(repo.lastCommitAt ?? repo.pushedAt, now)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground/70">Last release</dt>
          <dd>{repo.analysisDepth === "DEEP" ? (repo.lastReleaseAt ? formatAgo(repo.lastReleaseAt, now) : "none") : "–"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground/70">Age</dt>
          <dd>{formatYears(daysBetween(repo.ghCreatedAt, now))}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground/70">License</dt>
          <dd className="truncate">{repo.license ?? "None"}</dd>
        </div>
      </dl>

      <div className="mt-auto space-y-2 pt-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Grave</span>
              <span className="font-mono text-foreground">{repo.graveScore ?? "–"}</span>
            </div>
            <ScoreBar value={repo.graveScore} tone="grave" />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Revival</span>
              <span className="font-mono text-foreground">{repo.revivalScore ?? "–"}</span>
            </div>
            <ScoreBar value={repo.revivalScore} tone="revival" />
          </div>
        </div>
        {repo.analysisDepth === "QUICK" && (
          <Badge variant="outline" className="text-[10px]" title="Scores come from repository metadata only. Open the repository to run the full analysis.">
            Quick scan
          </Badge>
        )}
      </div>
    </Link>
  );
}
