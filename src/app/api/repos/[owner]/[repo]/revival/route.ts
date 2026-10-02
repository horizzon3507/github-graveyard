import { json, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { readRepoParams, type RepoParams } from "@/lib/repo-route";
import { getRepositoryDetail } from "@/database/repository-detail";

export const dynamic = "force-dynamic";

export const GET = route<RepoParams>(async (request, context) => {
  enforceRateLimit(request, "revival", 60);
  const { owner, name } = await readRepoParams(context);
  const detail = await getRepositoryDetail(owner, name);
  if (!detail?.analysis) throw new AppError("not_found", "Repository not found. Analyze it first.");
  const a = detail.analysis;
  return json({
    disclaimer: "Automatic analysis computed by GitHub Graveyard from public GitHub data. Scores are estimates, not objective truth.",
    status: a.status,
    depth: a.depth,
    lastAnalyzedAt: a.lastAnalyzedAt,
    graveScore: { score: a.graveScore, confidence: a.graveConfidence, factors: a.graveFactors },
    revivalScore: { score: a.revivalScore, confidence: a.revivalConfidence, factors: a.revivalFactors },
    hiddenGemScore: a.hiddenGemScore,
    communityScore: a.communityScore,
    difficulty: a.difficulty,
    effort: a.effort,
    challenges: a.challenges,
    modernizationSuggestions: a.modernizationSuggestions,
    technologies: a.technologies,
    roadmap: a.roadmap,
    issuesWorthSolving: a.issuesWorthSolving,
    abandonmentSignals: a.abandonmentSignals,
    communitySignals: a.communitySignals,
    license: a.licenseAssessment,
    dependencyHealth: a.dependencyHealth,
    buildSignal: a.buildSignal,
    notes: a.notes,
  });
});
