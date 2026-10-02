import { ExternalLink, GitCompare, GitFork, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatAgo, formatCompact } from "@/lib/utils";
import type { RepositoryDetail } from "@/database/repository-detail";

export function ActiveForks({ repo, failed }: { repo: RepositoryDetail; failed: boolean }) {
  const forks = repo.forkList;
  const active = forks.filter((f) => f.isActive);
  const shown = active.length > 0 ? active : [];

  if (repo.analysisDepth !== "DEEP") {
    return <p className="surface p-5 text-sm text-muted-foreground">Fork activity is measured by the full analysis.</p>;
  }
  if (failed) {
    return <p className="surface p-5 text-sm text-muted-foreground">Fork activity could not be checked because a GitHub request failed (usually the rate limit). The analysis retries automatically within the hour.</p>;
  }
  if (shown.length === 0) {
    return (
      <div className="surface space-y-2 p-5 text-sm">
        <p className="font-medium">No active descendants found.</p>
        <p className="text-muted-foreground">
          We looked at the {forks.length > 0 ? `${forks.length} most promising` : "most-starred"} of this repository&apos;s {repo.forks.toLocaleString("en")} forks and none show commits in the last year. If you revive it, you would likely be the first.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-lg font-semibold tracking-tight">
        {active.length} {active.length === 1 ? "fork is" : "forks are"} still alive.
      </p>
      <ul className="grid gap-3">
        {shown.map((f) => (
          <li key={f.id} className="surface grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <a href={f.htmlUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:text-grave-green">
                  <GitFork className="size-4 text-muted-foreground" /> {f.fullName} <ExternalLink className="size-3 text-muted-foreground" />
                </a>
                <Badge variant="green">Active descendant</Badge>
              </div>
              {f.description && <p className="line-clamp-2 text-sm text-muted-foreground">{f.description}</p>}
              <dl className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><Star className="size-3.5" /> <dd>{formatCompact(f.stars)} stars</dd></div>
                <div><dd><span className="text-foreground">{f.recentCommits ?? "–"}</span> commits in 12 months</dd></div>
                {f.contributors !== null && <div className="flex items-center gap-1.5"><Users className="size-3.5" /> <dd>{f.contributors} contributors</dd></div>}
                <div><dd>Last commit {formatAgo(f.lastCommitAt ?? f.pushedAt)}</dd></div>
                <div>
                  <dd>
                    <span className="text-grave-green">{f.aheadBy ?? "?"} ahead</span> · <span className="text-grave-purple">{f.behindBy ?? "?"} behind</span> the original
                  </dd>
                </div>
              </dl>
            </div>
            <Button asChild variant="secondary" size="sm">
              <a href={`https://github.com/${repo.owner}/${repo.name}/compare/${repo.defaultBranch}...${f.owner}:${f.defaultBranch}`} target="_blank" rel="noopener noreferrer">
                <GitCompare /> Compare Fork
              </a>
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Looked at the top forks by stars that were pushed after the original went quiet. Forks with no stars may be missing.</p>
    </div>
  );
}
