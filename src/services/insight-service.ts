import "server-only";
import type { AiConnection } from "@/generated/prisma/client";
import { getRepositoryDetail } from "@/database/repository-detail";
import { AppError } from "@/lib/errors";
import { parseRepoInput } from "@/lib/validation";
import { daysBetween } from "@/lib/utils";
import { INSIGHT_SYSTEM, buildInsightPrompt } from "@/analysis/insight-prompt";
import { readAnalysis } from "@/features/repo/analysis-data";
import { providerFor, touch } from "@/services/ai-connection-service";

export async function generateInsight(row: AiConnection, repo: string) {
  const ref = parseRepoInput(repo);
  if (!ref) throw new AppError("invalid_input", "Expected a repository like owner/name.");
  const detail = await getRepositoryDetail(ref.owner, ref.name);
  if (!detail) throw new AppError("not_found", "Repository not found. Open its page first so it gets analyzed.");
  const analysis = readAnalysis(detail);
  if (!analysis) throw new AppError("not_found", "This repository has no analysis yet.");

  const prompt = buildInsightPrompt({
    fullName: `${detail.owner}/${detail.name}`,
    description: detail.description,
    summary: analysis.summary,
    daysSinceCommit: daysBetween(detail.lastActivityAt),
    archived: detail.archived,
    stars: detail.stars,
    forks: detail.forks,
    license: detail.licenseName,
    graveScore: analysis.graveScore,
    revivalScore: analysis.revivalScore,
    difficulty: analysis.difficulty,
    abandonmentSignals: analysis.abandonmentSignals.map((s) => s.text),
    communitySignals: analysis.communitySignals.map((s) => s.text),
    technologies: analysis.technologies.map((t) => `${t.name} -> ${t.modern}`),
    challenges: analysis.challenges.map((c) => c.text),
    activeForks: detail.forkList.filter((f) => f.isActive).slice(0, 3).map((f) => `${f.fullName} (${f.recentCommits ?? "?"} commits in 12 months, ${f.aheadBy ?? "?"} ahead)`),
    topIssues: [...analysis.issues.mostRequested, ...analysis.issues.criticalBugs].slice(0, 5).map((i) => `#${i.number} ${i.title}`),
    readmeExcerpt: detail.snapshotData?.readmeExcerpt?.slice(0, 1200) ?? null,
  });

  const provider = providerFor(row);
  const text = await provider.complete({ system: INSIGHT_SYSTEM, prompt, maxTokens: 450 });
  if (!text) throw new AppError("github_unavailable", "The AI returned an empty answer.");
  await touch(row);
  return { text, provider: row.provider, model: row.model };
}
