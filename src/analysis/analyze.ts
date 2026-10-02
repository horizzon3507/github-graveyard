import type { AnalysisResult, DependencyHealth, SnapshotData } from "@/types/analysis";
import type { RepoMetadata } from "@/types/github";
import { calculateGraveScore, detectAbandonmentNotice } from "@/analysis/grave-score";
import { calculateRevivalScore } from "@/analysis/revival-score";
import { assessLicense } from "@/analysis/license";
import { detectTechnologies, techDebtPoints } from "@/analysis/technology";
import { EMPTY_DEPENDENCY_HEALTH } from "@/analysis/dependencies";
import { assessDocumentation, detectTests } from "@/analysis/project-signals";
import { countMaintenanceRequests, findIssuesWorthSolving } from "@/analysis/issues";
import { assessDifficulty, calculateCommunityScore, calculateHiddenGemScore } from "@/analysis/rankings";
import { buildAbandonmentSignals, buildChallenges, buildCommunitySignals, buildRoadmap, buildSuggestions } from "@/analysis/insights";

export const ALGORITHM_VERSION = 2;

export interface ForkAssessment {
  fullName: string;
  stars: number;
  pushedAt: string;
  aheadBy: number | null;
  behindBy: number | null;
  recentCommits: number | null;
  contributors: number | null;
  lastCommitAt: string | null;
  isActive: boolean;
}

export interface AnalysisInput {
  now: Date;
  repo: RepoMetadata;
  lastCommitAt: Date | null;
  lastReleaseAt: Date | null;
  /** null for a quick scan built from search metadata alone. */
  data: SnapshotData | null;
  files: Record<string, string>;
  paths: string[];
  readme: string | null;
  forks: ForkAssessment[];
  dependencyHealth: DependencyHealth;
  summary: string | null;
}

const YEAR_MS = 365 * 86_400_000;

export function analyzeRepository(input: AnalysisInput): AnalysisResult {
  const { now, repo, data } = input;
  const lastActivityAt = input.lastCommitAt ?? new Date(repo.pushedAt);
  const daysSinceCommit = Math.max(0, (now.getTime() - lastActivityAt.getTime()) / 86_400_000);
  const daysSinceRelease = input.lastReleaseAt ? Math.max(0, (now.getTime() - input.lastReleaseAt.getTime()) / 86_400_000) : null;
  const license = assessLicense(repo.license);
  const readmeNotice = detectAbandonmentNotice(input.readme);

  const openSample = data ? data.issueSample.filter((i) => !i.isPullRequest && i.state === "open") : [];
  const unanswered = data ? openSample.filter((i) => i.comments === 0).length : null;
  const stalePrs = data ? data.openPullRequests.filter((p) => now.getTime() - new Date(p.updatedAt).getTime() > YEAR_MS).length : 0;
  const activeContributors12m = data?.commitActivity ? data.commitActivity.contributors.filter((c) => c.recent12m > 0).length : null;
  const maintainerKnown = Boolean(data?.topContributor);

  const grave = calculateGraveScore({
    now,
    lastActivityAt,
    archived: repo.archived,
    releases: data ? { lastReleaseAt: input.lastReleaseAt, count: data.releaseCount } : null,
    issues: data ? { openIssues: repo.openIssues, unanswered: unanswered ?? 0, sampleSize: openSample.length } : null,
    pullRequests: data ? { open: data.openPullRequests.length, stale: stalePrs, truncated: data.openPullRequestsTruncated } : null,
    monthlyCommits: data?.commitActivity?.monthly ?? null,
    maintainerLastActiveAt: maintainerKnown ? (data!.maintainerLastActiveAt ? new Date(data!.maintainerLastActiveAt) : null) : undefined,
    readmeNotice,
    activeContributors12m,
  });

  const technologies = data ? detectTechnologies({ files: input.files, paths: input.paths }) : [];
  const { hasTests, hasCi } = detectTests(input.paths);
  const docs = assessDocumentation(input.readme, input.paths);
  const codeBytes = data ? Object.values(data.languages).reduce((a, b) => a + b, 0) : repo.sizeKb * 1024;
  const languageCount = data ? Object.keys(data.languages).length : repo.language ? 1 : 0;
  const issuesSample = data?.issueSample ?? [];
  const seenIssues = new Set(issuesSample.map((i) => i.number));
  const allIssues = [...issuesSample, ...(data?.topOpenIssues ?? []).filter((i) => !seenIssues.has(i.number))];
  const issuesLast12m = issuesSample.filter((i) => !i.isPullRequest && now.getTime() - new Date(i.createdAt).getTime() < YEAR_MS).length;
  const pullRequestsLast12m = issuesSample.filter((i) => i.isPullRequest && now.getTime() - new Date(i.createdAt).getTime() < YEAR_MS).length;
  const maintenanceRequests = countMaintenanceRequests(allIssues);
  const activeForks = input.forks.filter((f) => f.isActive);
  const dependencyHealth = data ? input.dependencyHealth : EMPTY_DEPENDENCY_HEALTH;

  const revival = calculateRevivalScore({
    stars: repo.stars,
    forks: repo.forks,
    downloadsLastMonth: data?.downloadsLastMonth ?? null,
    license,
    sizeKb: repo.sizeKb,
    deep: data
      ? {
          issuesLast12m,
          maintenanceRequests,
          pullRequestsLast12m,
          docs,
          tests: { hasTests, hasCi },
          codeBytes,
          languageCount: Math.max(1, languageCount),
          fileCount: data.treeFileCount,
          techDebtPoints: techDebtPoints(technologies),
          dependencyHealth,
          contributors: data.totalContributors ?? data.commitActivity?.contributors.length ?? null,
          activeForks: activeForks.length,
        }
      : null,
  });

  const recentlyUpdatedShare = openSample.length === 0 ? 0 : openSample.filter((i) => now.getTime() - new Date(i.updatedAt).getTime() < YEAR_MS / 2).length / openSample.length;
  const communityScore = calculateCommunityScore({
    deep: data ? { issuesLast12m, pullRequestsLast12m, activeForks: activeForks.length, maintenanceRequests, recentlyUpdatedShare } : null,
    forks: repo.forks,
    openIssues: repo.openIssues,
  });

  const hiddenGemScore = calculateHiddenGemScore({
    daysSinceActivity: daysSinceCommit,
    stars: repo.stars,
    activeForkCount: data ? activeForks.length : null,
    sizeBytes: codeBytes,
    revivalScore: revival.score,
  });

  const difficulty = data
    ? assessDifficulty({ findings: technologies, dependencyHealth, hasTests, hasCi, codeBytes, languageCount, daysSinceActivity: daysSinceCommit })
    : null;

  const issuesWorthSolving = findIssuesWorthSolving(allIssues, data ? repo.openIssues : null);
  const hasDeepData = Boolean(data);

  const buildSignal: AnalysisResult["buildSignal"] = data?.workflowRun
    ? {
        source: "github-actions",
        conclusion: data.workflowRun.conclusion,
        at: data.workflowRun.createdAt,
        note: "Last GitHub Actions run on the repository. The Graveyard never compiles code: treat this as a hint, not proof.",
      }
    : {
        source: "none",
        conclusion: null,
        at: null,
        note: !data ? "Run the full analysis for build hints." : data.failed?.includes("workflow runs") ? "CI runs could not be checked (GitHub request failed)." : "No GitHub Actions runs found. The Graveyard cannot tell whether the project still builds.",
      };

  return {
    algorithmVersion: ALGORITHM_VERSION,
    depth: data ? "DEEP" : "QUICK",
    grave,
    revival,
    hiddenGemScore,
    communityScore,
    difficulty: difficulty?.difficulty ?? null,
    effort: difficulty?.effort ?? null,
    abandonmentSignals: buildAbandonmentSignals({
      now,
      daysSinceCommit,
      daysSinceRelease,
      archived: repo.archived,
      data,
      readmeNotice,
      dependencyHealth,
      unanswered,
      activeContributors12m,
    }),
    communitySignals: buildCommunitySignals({ now, data, lastReleaseAt: input.lastReleaseAt, forks: input.forks, maintenanceRequests, stars: repo.stars, openIssues: repo.openIssues }),
    technologies,
    challenges: buildChallenges({ findings: technologies, dependencyHealth, hasTests, hasCi, license, codeBytes, hasDeepData }),
    modernizationSuggestions: data ? buildSuggestions({ findings: technologies, dependencyHealth, hasCi, hasTests, hasDeepData }) : [],
    roadmap: data
      ? buildRoadmap({ fullName: `${repo.owner}/${repo.name}`, findings: technologies, dependencyHealth, hasCi, hasTests, hasDeepData, issues: issuesWorthSolving, activeForks, license })
      : [],
    issuesWorthSolving,
    licenseAssessment: license,
    buildSignal,
    dependencyHealth,
    summary: input.summary,
    notes: data?.notes ?? [],
  };
}
