import type { RepositoryDetail } from "@/database/repository-detail";
import type { Challenge, CommunitySignal, DependencyHealth, FactorResult, IssuesWorthSolving, LicenseAssessment, BuildSignal, RoadmapPhase, Signal, Suggestion, TechFinding } from "@/types/analysis";

export function readAnalysis(detail: RepositoryDetail) {
  const a = detail.analysis;
  if (!a) return null;
  return {
    status: a.status,
    depth: a.depth,
    error: a.error,
    lastAnalyzedAt: a.lastAnalyzedAt,
    graveScore: a.graveScore,
    graveConfidence: a.graveConfidence,
    revivalScore: a.revivalScore,
    revivalConfidence: a.revivalConfidence,
    hiddenGemScore: a.hiddenGemScore,
    communityScore: a.communityScore,
    difficulty: a.difficulty,
    effort: a.effort,
    summary: a.summary,
    summarySource: a.summarySource,
    graveFactors: a.graveFactors as unknown as FactorResult[],
    revivalFactors: a.revivalFactors as unknown as FactorResult[],
    abandonmentSignals: a.abandonmentSignals as unknown as Signal[],
    communitySignals: a.communitySignals as unknown as CommunitySignal[],
    technologies: a.technologies as unknown as TechFinding[],
    challenges: a.challenges as unknown as Challenge[],
    suggestions: a.modernizationSuggestions as unknown as Suggestion[],
    roadmap: a.roadmap as unknown as RoadmapPhase[],
    issues: a.issuesWorthSolving as unknown as IssuesWorthSolving,
    license: a.licenseAssessment as unknown as LicenseAssessment,
    buildSignal: a.buildSignal as unknown as BuildSignal,
    dependencyHealth: a.dependencyHealth as unknown as DependencyHealth,
    notes: a.notes as unknown as string[],
    failed: ((detail.snapshotData?.failed ?? []) as string[]),
  };
}

export type RepoAnalysis = NonNullable<ReturnType<typeof readAnalysis>>;
