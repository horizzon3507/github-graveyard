import Link from "next/link";
import { CircleDot, Eye, ExternalLink, GitFork, Globe, Scale, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatAgo, formatCompact, formatDate, formatNumber } from "@/lib/utils";
import type { RepositoryDetail } from "@/database/repository-detail";
import type { SnapshotData } from "@/types/analysis";

const LANG_COLORS = ["#6ee7a8", "#7aa7ff", "#a995ff", "#e9c46a", "#f0a3c4", "#8a8e99"];

function LanguageBar({ languages }: { languages: Record<string, number> }) {
  const entries = Object.entries(languages).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;
  const top = entries.slice(0, 5);
  const rest = entries.slice(5).reduce((s, [, v]) => s + v, 0);
  const parts = rest > 0 ? [...top, ["Other", rest] as [string, number]] : top;
  return (
    <div className="space-y-2">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/7" role="img" aria-label={`Languages: ${parts.map(([n, v]) => `${n} ${Math.round((v / total) * 100)}%`).join(", ")}`}>
        {parts.map(([name, bytes], i) => (
          <div key={name} style={{ width: `${(bytes / total) * 100}%`, background: LANG_COLORS[i] }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {parts.map(([name, bytes], i) => (
          <li key={name} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: LANG_COLORS[i] }} />
            {name} <span className="font-mono">{Math.round((bytes / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5" />} {label}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function RepoHeader({ repo, data, actions }: { repo: RepositoryDetail; data: SnapshotData | null; actions: React.ReactNode }) {
  const now = new Date();
  const languages = data?.languages && Object.keys(data.languages).length > 0 ? data.languages : null;
  return (
    <header className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-sm text-muted-foreground">
            <Link href={`/explore?owner=${repo.owner}&includeActive=1`} className="hover:text-foreground">
              {repo.owner}
            </Link>{" "}
            <span className="text-muted-foreground/50">/</span>
          </p>
          <h1 className="text-3xl font-semibold tracking-tight break-words sm:text-4xl">{repo.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> View on GitHub
            </a>
          </Button>
          {actions}
        </div>
      </div>

      <p className="max-w-3xl text-base text-muted-foreground">{repo.description ?? "No description provided."}</p>

      {repo.topics.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Topics">
          {repo.topics.slice(0, 12).map((t) => (
            <li key={t}>
              <Link href={`/explore?topic=${encodeURIComponent(t)}`}>
                <Badge variant="blue">{t}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <dl className="surface grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 lg:grid-cols-5">
        <Fact icon={Star} label="Stars" value={formatNumber(repo.stars)} />
        <Fact icon={GitFork} label="Forks" value={formatNumber(repo.forks)} />
        <Fact icon={Eye} label="Watchers" value={formatNumber(repo.watchers)} />
        <Fact icon={CircleDot} label="Open issues & PRs" value={formatNumber(repo.openIssues)} />
        <Fact icon={Scale} label="License" value={repo.licenseName ?? "None detected"} />
        <Fact label={repo.lastCommitAt ? "Last commit" : "Last push"} value={<span title={formatDate(repo.lastCommitAt ?? repo.pushedAt)}>{formatAgo(repo.lastCommitAt ?? repo.pushedAt, now)}</span>} />
        <Fact label="Last release" value={repo.analysisDepth === "DEEP" ? (repo.lastReleaseAt ? <span title={formatDate(repo.lastReleaseAt)}>{formatAgo(repo.lastReleaseAt, now)}</span> : "No releases") : "Pending analysis"} />
        <Fact icon={Users} label="Contributors" value={repo.contributors !== null ? formatCompact(repo.contributors) : "Pending analysis"} />
        <Fact label="Created" value={formatDate(repo.ghCreatedAt)} />
        {repo.homepage && (
          <Fact
            icon={Globe}
            label="Homepage"
            value={
              /^https?:\/\//.test(repo.homepage) ? (
                <a href={repo.homepage} target="_blank" rel="noopener noreferrer nofollow" className="block max-w-40 truncate text-grave-blue hover:underline">
                  {repo.homepage.replace(/^https?:\/\//, "")}
                </a>
              ) : null
            }
          />
        )}
        {languages && (
          <div className="col-span-full">
            <LanguageBar languages={languages} />
          </div>
        )}
        {!languages && repo.language && <Fact label="Main language" value={repo.language} />}
      </dl>
    </header>
  );
}
