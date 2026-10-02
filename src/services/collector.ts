import type { GitHubProvider, RepoMetadata, ForkInfo } from "@/types/github";
import type { DependencyHealth, SnapshotData } from "@/types/analysis";
import type { RegistryProvider } from "@/providers/registry/registry-provider";
import type { AIProvider } from "@/providers/ai/types";
import type { ForkAssessment } from "@/analysis/analyze";
import { MANIFEST_FILES, parsePackageJson } from "@/analysis/technology";
import { EMPTY_DEPENDENCY_HEALTH, assessDependencies, extractDependencies, type LatestVersion } from "@/analysis/dependencies";
import { bucketByMonth } from "@/analysis/activity";
import { summarizeProject } from "@/analysis/summary";
import { GitHubRateLimitError, isAppError } from "@/lib/errors";

export interface CollectOptions {
  forkDepth: number;
  now?: Date;
}

export interface CollectedData {
  data: SnapshotData;
  files: Record<string, string>;
  paths: string[];
  readme: string | null;
  forks: ForkAssessment[];
  forkRecords: (ForkInfo & ForkAssessment)[];
  dependencyHealth: DependencyHealth;
  lastCommitAt: Date | null;
  lastReleaseAt: Date | null;
  summary: string | null;
  summarySource: string | null;
  rateLimited: boolean;
}

const YEAR_MS = 365 * 86_400_000;

export async function collectRepositoryData(
  github: GitHubProvider,
  registry: RegistryProvider,
  ai: AIProvider | null,
  repo: RepoMetadata,
  options: CollectOptions,
): Promise<CollectedData> {
  const now = options.now ?? new Date();
  const { owner, name } = repo;
  const notes: string[] = [];
  let rateLimited = false;

  const safe = async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof GitHubRateLimitError) rateLimited = true;
      notes.push(`${label}: ${isAppError(error) ? error.message : "request failed"}`);
      return undefined;
    }
  };

  const [commit, releases, recentItems, topOpen, openPrs, languages, activity, contributorCount, tree] = await Promise.all([
    safe("last commit", () => github.getLastCommit(owner, name, repo.defaultBranch)),
    safe("releases", () => github.getReleases(owner, name)),
    safe("issues", () => github.listIssues(owner, name, { state: "all", pages: 2, sort: "created" })),
    safe("top issues", () => github.listIssues(owner, name, { state: "open", pages: 1, sort: "comments" })),
    safe("pull requests", () => github.listOpenPullRequests(owner, name)),
    safe("languages", () => github.getLanguages(owner, name)),
    safe("commit history", () => github.getCommitActivity(owner, name)),
    safe("contributors", () => github.getContributorCount(owner, name)),
    safe("file tree", () => github.getTree(owner, name, repo.defaultBranch)),
  ]);

  const commitActivity = activity && !activity.pending ? activity.data : null;
  if (activity?.pending) notes.push("Commit history is still being computed by GitHub. Re-run the analysis in a few minutes for the activity graph.");
  const paths = tree?.paths ?? [];
  if (tree?.truncated) notes.push("The repository tree is very large, so file-based checks only saw part of it.");

  const files: Record<string, string> = {};
  const rootFiles = new Set(paths.filter((p) => !p.includes("/")));
  const wanted = tree ? MANIFEST_FILES.filter((f) => rootFiles.has(f)) : [];
  const csproj = paths.find((p) => /\.csproj$/.test(p) && p.split("/").length <= 3);
  const readmePath = paths.find((p) => /^readme(\.(md|markdown|rst|txt|adoc))?$/i.test(p)) ?? (tree ? undefined : "README.md");

  const [manifestContents, readme, csprojContent] = await Promise.all([
    Promise.all(wanted.map((f) => github.getFile(owner, name, repo.defaultBranch, f).catch(() => null))),
    readmePath ? github.getFile(owner, name, repo.defaultBranch, readmePath).catch(() => null) : Promise.resolve(null),
    csproj ? github.getFile(owner, name, repo.defaultBranch, csproj).catch(() => null) : Promise.resolve(null),
  ]);
  wanted.forEach((f, i) => {
    const content = manifestContents[i];
    if (content) files[f] = content;
  });
  if (csproj && csprojContent) files[csproj] = csprojContent;

  const { ecosystem, deps, total } = extractDependencies(files);
  const latestEntries = await Promise.all(
    deps.map(async (d) => [d.name, ecosystem === "npm" ? await registry.npmLatest(d.name) : await registry.pypiLatest(d.name)] as const),
  );
  const dependencyHealth = ecosystem ? assessDependencies(ecosystem, total, deps, Object.fromEntries(latestEntries) as Record<string, LatestVersion | null>) : EMPTY_DEPENDENCY_HEALTH;

  const pkg = parsePackageJson(files["package.json"]);
  const downloads = pkg?.name && !(pkg as { private?: boolean }).private ? await registry.npmDownloadsLastMonth(pkg.name) : null;

  const topContributor = commitActivity?.contributors.find((c) => c.login !== "unknown")?.login ?? null;
  const maintainerLastActiveAt = topContributor ? ((await safe("maintainer activity", () => github.getUserLastActivity(topContributor))) ?? null) : null;

  const hasWorkflows = paths.some((p) => p.startsWith(".github/workflows/"));
  const run = hasWorkflows ? await safe("workflow runs", () => github.getLatestWorkflowRun(owner, name)) : undefined;

  const lastCommitAt = commit?.commit?.date ? new Date(commit.commit.date) : null;
  const stableReleases = releases?.releases.filter((r) => !r.prerelease) ?? [];
  const releaseList = stableReleases.length > 0 ? stableReleases : (releases?.releases ?? []);
  const lastReleaseAt = releaseList.length > 0 ? new Date(Math.max(...releaseList.map((r) => new Date(r.publishedAt).getTime()))) : null;

  const forkAssessments = repo.forks > 0 && options.forkDepth > 0 ? await collectForks(github, repo, lastCommitAt ?? new Date(repo.pushedAt), options.forkDepth, now, safe) : [];

  const recent = recentItems ?? [];
  const summary = await summarizeProject(ai, { fullName: `${owner}/${name}`, description: repo.description, readme });

  const data: SnapshotData = {
    languages: languages ?? {},
    commitActivity,
    releases: (releases?.releases ?? []).slice(0, 100),
    releaseCount: releases?.total ?? 0,
    issueSample: recent,
    topOpenIssues: topOpen ?? [],
    openPullRequests: openPrs?.items ?? [],
    openPullRequestsTruncated: openPrs?.truncated ?? false,
    recentItemsByMonth: {
      issues: bucketByMonth(recent.filter((i) => !i.isPullRequest).map((i) => i.createdAt)),
      pullRequests: bucketByMonth(recent.filter((i) => i.isPullRequest).map((i) => i.createdAt)),
    },
    treeFileCount: tree ? paths.length : null,
    readmeExcerpt: readme ? readme.slice(0, 1500) : null,
    manifests: Object.keys(files),
    totalCommits: commit?.totalCommits ?? null,
    totalContributors: contributorCount ?? null,
    maintainerLastActiveAt,
    topContributor,
    downloadsLastMonth: downloads,
    workflowRun: run ? { conclusion: run.conclusion, createdAt: run.createdAt, name: run.name } : null,
    notes,
  };

  return {
    data,
    files,
    paths,
    readme,
    forks: forkAssessments,
    forkRecords: forkAssessments as (ForkInfo & ForkAssessment)[],
    dependencyHealth,
    lastCommitAt,
    lastReleaseAt,
    summary: summary.summary,
    summarySource: summary.source,
    rateLimited,
  };
}

async function collectForks(
  github: GitHubProvider,
  repo: RepoMetadata,
  upstreamLastActivity: Date,
  depth: number,
  now: Date,
  safe: <T>(label: string, fn: () => Promise<T>) => Promise<T | undefined>,
): Promise<(ForkAssessment & ForkInfo)[]> {
  const list = await safe("forks", () => github.listForks(repo.owner, repo.name, 30));
  if (!list) return [];
  const candidates = list.items
    .filter((f) => new Date(f.pushedAt).getTime() > upstreamLastActivity.getTime() + 7 * 86_400_000 && now.getTime() - new Date(f.pushedAt).getTime() < 1.5 * YEAR_MS)
    .sort((a, b) => b.stars - a.stars || b.pushedAt.localeCompare(a.pushedAt))
    .slice(0, depth);

  const inspected = await Promise.all(
    candidates.map(async (fork) => {
      const result = await safe(`fork ${fork.fullName}`, () => github.inspectFork(repo.owner, repo.name, repo.defaultBranch, fork));
      const assessment: ForkAssessment & ForkInfo = {
        ...fork,
        aheadBy: result?.aheadBy ?? null,
        behindBy: result?.behindBy ?? null,
        recentCommits: result?.recentCommits ?? null,
        contributors: result?.contributors ?? null,
        lastCommitAt: result?.lastCommitAt ?? null,
        isActive: result
          ? result.recentCommits > 0 && (result.aheadBy === null || result.aheadBy > 0)
          : now.getTime() - new Date(fork.pushedAt).getTime() < YEAR_MS,
      };
      return assessment;
    }),
  );
  return inspected;
}
