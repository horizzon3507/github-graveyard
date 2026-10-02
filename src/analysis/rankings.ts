import type { TechFinding, DependencyHealth } from "@/types/analysis";
import { clamp } from "@/lib/utils";
import { logScale } from "@/analysis/scoring";
import { techDebtPoints } from "@/analysis/technology";

export interface HiddenGemInput {
  daysSinceActivity: number;
  stars: number;
  activeForkCount: number | null;
  sizeBytes: number;
  revivalScore: number;
}

/**
 * Hidden Gem score (0-100): abandoned enough, popular enough, not already continued by
 * someone else, small enough to take over, and with high revival potential.
 */
export function calculateHiddenGemScore(i: HiddenGemInput): number {
  const abandonmentFit = clamp((i.daysSinceActivity - 180) / 550);
  const starsFit = i.stars < 50 ? 0 : i.stars <= 10_000 ? clamp(Math.log10(i.stars / 50) / Math.log10(20)) : clamp(1 - Math.log10(i.stars / 10_000) * 0.3, 0.6, 1);
  const forkGap = i.activeForkCount === null ? 0.5 : i.activeForkCount === 0 ? 1 : i.activeForkCount === 1 ? 0.5 : i.activeForkCount === 2 ? 0.2 : 0;
  const compactness = i.sizeBytes <= 0 ? 0.5 : clamp(1 - Math.log10(Math.max(i.sizeBytes, 500_000) / 500_000) / 2);
  return Math.round(100 * (0.3 * (i.revivalScore / 100) + 0.2 * abandonmentFit + 0.2 * starsFit + 0.15 * forkGap + 0.15 * compactness));
}

export interface CommunityInput {
  deep: {
    issuesLast12m: number;
    pullRequestsLast12m: number;
    activeForks: number;
    maintenanceRequests: number;
    recentlyUpdatedShare: number;
  } | null;
  forks: number;
  openIssues: number;
}

/** Community score (0-100): how much demand and activity still surrounds the project. */
export function calculateCommunityScore(i: CommunityInput): number {
  if (!i.deep) {
    return Math.round(60 * (0.6 * logScale(i.forks, 1000) + 0.4 * logScale(i.openIssues, 200)));
  }
  const d = i.deep;
  return Math.round(
    100 *
      (0.3 * clamp(d.issuesLast12m / 30) +
        0.15 * clamp(d.pullRequestsLast12m / 10) +
        0.25 * clamp(d.activeForks / 5) +
        0.15 * clamp(d.maintenanceRequests / 5) +
        0.15 * clamp(d.recentlyUpdatedShare)),
  );
}

export interface DifficultyInput {
  findings: TechFinding[];
  dependencyHealth: DependencyHealth;
  hasTests: boolean;
  hasCi: boolean;
  codeBytes: number;
  languageCount: number;
  daysSinceActivity: number;
}

export function assessDifficulty(i: DifficultyInput): { difficulty: "EASY" | "MODERATE" | "HARD" | "EXTREME"; effort: "SMALL" | "MEDIUM" | "LARGE"; points: number } {
  let points = techDebtPoints(i.findings);
  points += Math.min(3, i.dependencyHealth.deprecated.length);
  points += Math.min(3, i.dependencyHealth.outdated.filter((o) => o.majorsBehind >= 2).length);
  if (!i.hasTests) points += 2;
  if (!i.hasCi) points += 1;
  if (i.codeBytes > 10 * 1024 * 1024) points += 3;
  else if (i.codeBytes > 2 * 1024 * 1024) points += 2;
  else if (i.codeBytes > 500 * 1024) points += 1;
  if (i.languageCount > 3) points += 1;
  if (i.daysSinceActivity > 1825) points += 1;

  const difficulty = points <= 3 ? "EASY" : points <= 7 ? "MODERATE" : points <= 12 ? "HARD" : "EXTREME";
  const effort = i.codeBytes > 10 * 1024 * 1024 || difficulty === "HARD" || difficulty === "EXTREME" ? "LARGE" : i.codeBytes < 500 * 1024 && difficulty === "EASY" ? "SMALL" : "MEDIUM";
  return { difficulty, effort, points };
}
