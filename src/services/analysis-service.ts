import "server-only";
import type { Repository, RepositoryAnalysis } from "@/generated/prisma/client";
import { db } from "@/database/client";
import { env } from "@/lib/env";
import { GitHubRateLimitError, GitHubNotFoundError, isAppError } from "@/lib/errors";
import { analyzeRepository, ALGORITHM_VERSION } from "@/analysis/analyze";
import { collectRepositoryData } from "@/services/collector";
import { getGitHub } from "@/services/github";
import { getAIProvider } from "@/providers/ai";
import { analysisColumns, j, upsertRepository } from "@/services/repository-service";

const STALE_RUN_MS = 10 * 60_000;
const FAILURE_RETRY_MS = 15 * 60_000;
const running = new Set<string>();

export type AnalysisRequestOutcome = "started" | "running" | "fresh" | "deferred" | "backoff";

export function needsDeepAnalysis(analysis: Pick<RepositoryAnalysis, "depth" | "algorithmVersion" | "lastAnalyzedAt" | "status" | "startedAt" | "updatedAt"> | null, now = new Date()): boolean {
  if (!analysis) return true;
  if (analysis.status === "RUNNING" && analysis.startedAt && now.getTime() - analysis.startedAt.getTime() < STALE_RUN_MS) return false;
  if (analysis.status === "FAILED" && now.getTime() - analysis.updatedAt.getTime() < FAILURE_RETRY_MS) return false;
  if (analysis.depth === "QUICK" || analysis.algorithmVersion < ALGORITHM_VERSION) return true;
  const staleMs = env().ANALYSIS_STALE_DAYS * 86_400_000;
  return !analysis.lastAnalyzedAt || now.getTime() - analysis.lastAnalyzedAt.getTime() > staleMs;
}

/**
 * Claims the analysis for this repository (atomically, so concurrent requests only start one run)
 * and hands the work to `schedule`, which should detach it from the response (Next.js `after`).
 */
export async function requestDeepAnalysis(
  repository: Pick<Repository, "id">,
  opts: { force?: boolean; schedule?: (task: () => Promise<void>) => void } = {},
): Promise<AnalysisRequestOutcome> {
  const analysis = await db.repositoryAnalysis.findUnique({ where: { repositoryId: repository.id } });
  const now = new Date();
  if (analysis?.status === "RUNNING" && analysis.startedAt && now.getTime() - analysis.startedAt.getTime() < STALE_RUN_MS) return "running";
  if (!opts.force && analysis && analysis.status === "FAILED" && now.getTime() - analysis.updatedAt.getTime() < FAILURE_RETRY_MS) return "backoff";
  if (!opts.force && !needsDeepAnalysis(analysis, now)) return "fresh";
  if (running.size >= env().ANALYSIS_MAX_CONCURRENCY) return "deferred";

  const claimed = await db.repositoryAnalysis.updateMany({
    where: {
      repositoryId: repository.id,
      OR: [{ status: { not: "RUNNING" } }, { startedAt: { lt: new Date(now.getTime() - STALE_RUN_MS) } }, { startedAt: null }],
    },
    data: { status: "RUNNING", startedAt: now, error: null },
  });
  if (claimed.count === 0) return "running";

  const task = async () => {
    running.add(repository.id);
    try {
      await runDeepAnalysis(repository.id);
    } catch (error) {
      console.error(`[analysis] ${repository.id} failed`, error);
    } finally {
      running.delete(repository.id);
    }
  };
  (opts.schedule ?? ((t) => void t()))(task);
  return "started";
}

/** Runs the full analysis. Marks the analysis FAILED (with a machine-readable error) instead of throwing. */
export async function runDeepAnalysis(repositoryId: string): Promise<void> {
  const now = new Date();
  const repository = await db.repository.findUnique({ where: { id: repositoryId } });
  if (!repository) return;
  const fail = (error: string) => db.repositoryAnalysis.update({ where: { repositoryId }, data: { status: "FAILED", error } });

  try {
    const { github, registry } = getGitHub();
    const meta = await github.getRepository(repository.owner, repository.name);
    const refreshed = await upsertRepository(meta, repository.source, now);

    const e = env();
    const forkDepth = e.GITHUB_TOKEN ? e.ANALYSIS_FORK_DEPTH : Math.min(3, e.ANALYSIS_FORK_DEPTH);
    const collected = await collectRepositoryData(github, registry, getAIProvider(), meta, { forkDepth, now });

    if (collected.rateLimited && !collected.lastCommitAt && collected.paths.length === 0) {
      throw new GitHubRateLimitError(null);
    }

    const result = analyzeRepository({
      now,
      repo: meta,
      lastCommitAt: collected.lastCommitAt,
      lastReleaseAt: collected.lastReleaseAt,
      data: collected.data,
      files: collected.files,
      paths: collected.paths,
      readme: collected.readme,
      forks: collected.forks,
      dependencyHealth: collected.dependencyHealth,
      summary: collected.summary,
    });
    const lastActivityAt = collected.lastCommitAt ?? new Date(meta.pushedAt);

    await db.$transaction(async (tx) => {
      await tx.repositorySnapshot.create({
        data: {
          repositoryId,
          capturedAt: now,
          depth: "DEEP",
          stars: meta.stars,
          forks: meta.forks,
          watchers: meta.watchers,
          openIssues: meta.openIssues,
          contributors: collected.data.totalContributors,
          pushedAt: new Date(meta.pushedAt),
          lastCommitAt: collected.lastCommitAt,
          lastReleaseAt: collected.lastReleaseAt,
          data: j(collected.data),
        },
      });
      const old = await tx.repositorySnapshot.findMany({ where: { repositoryId }, orderBy: { capturedAt: "desc" }, skip: 3, select: { id: true } });
      if (old.length) await tx.repositorySnapshot.deleteMany({ where: { id: { in: old.map((s) => s.id) } } });

      await tx.repositoryFork.deleteMany({ where: { repositoryId } });
      if (collected.forkRecords.length) {
        await tx.repositoryFork.createMany({
          data: collected.forkRecords.map((f) => ({
            repositoryId,
            fullName: f.fullName,
            owner: f.owner,
            name: f.name,
            htmlUrl: f.htmlUrl,
            description: f.description,
            stars: f.stars,
            pushedAt: new Date(f.pushedAt),
            aheadBy: f.aheadBy,
            behindBy: f.behindBy,
            recentCommits: f.recentCommits,
            contributors: f.contributors,
            lastCommitAt: f.lastCommitAt ? new Date(f.lastCommitAt) : null,
            isActive: f.isActive,
          })),
        });
      }

      await tx.repositoryAnalysis.update({
        where: { repositoryId },
        data: { status: "COMPLETE", ...analysisColumns(result, now, { summarySource: collected.summarySource }) },
      });
      await tx.repository.update({
        where: { id: refreshed.id },
        data: {
          lastCommitAt: collected.lastCommitAt,
          lastReleaseAt: collected.lastReleaseAt,
          lastActivityAt,
          contributors: collected.data.totalContributors,
          graveScore: result.grave.score,
          revivalScore: result.revival.score,
          hiddenGemScore: result.hiddenGemScore,
          communityScore: result.communityScore,
          difficulty: result.difficulty,
          activeForkCount: collected.forks.filter((f) => f.isActive).length,
          analysisDepth: "DEEP",
        },
      });
    });
  } catch (error) {
    if (error instanceof GitHubRateLimitError) await fail(`rate_limited:${error.resetAt?.toISOString() ?? ""}`);
    else if (error instanceof GitHubNotFoundError) await fail("not_found:Repository is no longer available on GitHub.");
    else await fail(`failed:${isAppError(error) ? error.message : "Unexpected error while analyzing."}`);
    if (!isAppError(error)) console.error("[analysis] unexpected", error);
  }
}
