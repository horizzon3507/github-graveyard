import "server-only";
import { db } from "@/database/client";
import { env } from "@/lib/env";
import { thresholds } from "@/config/graveyard";
import { ALGORITHM_VERSION } from "@/analysis/analyze";
import { requestDeepAnalysis, runDeepAnalysis } from "@/services/analysis-service";
import { recomputeQuickAnalyses } from "@/services/repository-service";

export interface RefreshResult {
  attempted: number;
  analyzed: number;
  failed: { slug: string; error: string }[];
}

/**
 * Background job: deep-analyzes the most interesting repositories that only have a quick scan
 * (popular and abandoned first), then re-analyzes stale ones. Meant for cron or `pnpm jobs:refresh`.
 */
export async function refreshAnalyses(limit = 10, now = new Date()): Promise<RefreshResult> {
  await recomputeQuickAnalyses(now);
  const staleBefore = new Date(now.getTime() - env().ANALYSIS_STALE_DAYS * 86_400_000);
  const abandonedBefore = new Date(now.getTime() - thresholds.recentlyAbandonedDays * 86_400_000);

  const candidates = await db.repository.findMany({
    where: {
      OR: [{ lastActivityAt: { lt: abandonedBefore } }, { archived: true }],
      analysis: {
        is: {
          OR: [{ depth: "QUICK" }, { algorithmVersion: { lt: ALGORITHM_VERSION } }, { lastAnalyzedAt: { lt: staleBefore } }],
          NOT: { status: "RUNNING", startedAt: { gt: new Date(now.getTime() - 10 * 60_000) } },
        },
      },
    },
    orderBy: [{ analysisDepth: "asc" }, { stars: "desc" }],
    take: limit,
    select: { id: true, slug: true },
  });

  const result: RefreshResult = { attempted: candidates.length, analyzed: 0, failed: [] };
  for (const candidate of candidates) {
    const outcome = await requestDeepAnalysis(candidate, { force: true, schedule: () => undefined });
    if (outcome !== "started") continue;
    await runDeepAnalysis(candidate.id);
    const analysis = await db.repositoryAnalysis.findUnique({ where: { repositoryId: candidate.id }, select: { status: true, error: true } });
    if (analysis?.status === "COMPLETE") result.analyzed++;
    else {
      result.failed.push({ slug: candidate.slug, error: analysis?.error ?? "unknown" });
      if (analysis?.error?.startsWith("rate_limited")) break;
    }
  }
  return result;
}
