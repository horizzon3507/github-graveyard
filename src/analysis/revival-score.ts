import type { ScoreResult, DependencyHealth, LicenseAssessment } from "@/types/analysis";
import { clamp, formatNumber } from "@/lib/utils";
import { combine, logScale, type FactorDefinition } from "@/analysis/scoring";
import { licenseFriendliness } from "@/analysis/license";

export interface RevivalInput {
  stars: number;
  forks: number;
  downloadsLastMonth: number | null;
  license: LicenseAssessment;
  /** Deep-analysis signals; null in a quick scan. */
  deep: {
    issuesLast12m: number;
    maintenanceRequests: number;
    pullRequestsLast12m: number;
    docs: { score: number; notes: string[] };
    tests: { hasTests: boolean; hasCi: boolean };
    codeBytes: number;
    languageCount: number;
    fileCount: number | null;
    techDebtPoints: number;
    dependencyHealth: DependencyHealth;
    contributors: number | null;
    activeForks: number;
  } | null;
  /** Fallbacks available without deep analysis. */
  sizeKb: number;
}

export const REVIVAL_WEIGHTS = {
  stars: 14,
  forks: 8,
  downloads: 4,
  recentIssues: 7,
  maintenanceRequests: 6,
  recentPullRequests: 4,
  documentation: 8,
  tests: 7,
  license: 10,
  codeSize: 6,
  complexity: 4,
  techDebt: 8,
  dependencyHealth: 6,
  community: 8,
} as const;

export function calculateRevivalScore(input: RevivalInput): ScoreResult {
  const w = REVIVAL_WEIGHTS;
  const d = input.deep;
  const f: FactorDefinition[] = [];

  f.push({ key: "stars", label: "Stars", weight: w.stars, value: logScale(input.stars, 20_000), detail: `${formatNumber(input.stars)} stars (log scale, 20k+ is the ceiling).` });
  f.push({ key: "forks", label: "Forks", weight: w.forks, value: logScale(input.forks, 3_000), detail: `${formatNumber(input.forks)} forks (log scale, 3k+ is the ceiling).` });
  f.push({
    key: "downloads",
    label: "Downloads",
    weight: w.downloads,
    value: input.downloadsLastMonth === null ? null : logScale(input.downloadsLastMonth, 1_000_000),
    detail: input.downloadsLastMonth === null ? "No package registry downloads found." : `${formatNumber(input.downloadsLastMonth)} npm downloads in the last month.`,
  });
  f.push({
    key: "recentIssues",
    label: "Recent issues",
    weight: w.recentIssues,
    value: d ? clamp(d.issuesLast12m / 30) : null,
    detail: d ? `${d.issuesLast12m} issues opened in the last 12 months (30+ is the ceiling).` : "Not measured in a quick scan.",
  });
  f.push({
    key: "maintenanceRequests",
    label: "People asking for updates",
    weight: w.maintenanceRequests,
    value: d ? clamp(d.maintenanceRequests / 5) : null,
    detail: d ? `${d.maintenanceRequests} open issues ask about maintenance, updates or a successor.` : "Not measured in a quick scan.",
  });
  f.push({
    key: "recentPullRequests",
    label: "Recent pull requests",
    weight: w.recentPullRequests,
    value: d ? clamp(d.pullRequestsLast12m / 10) : null,
    detail: d ? `${d.pullRequestsLast12m} pull requests opened in the last 12 months.` : "Not measured in a quick scan.",
  });
  f.push({
    key: "documentation",
    label: "Documentation quality",
    weight: w.documentation,
    value: d ? d.docs.score : null,
    detail: d ? (d.docs.notes.join(" ") || "Minimal documentation.") : "Not measured in a quick scan.",
  });
  f.push({
    key: "tests",
    label: "Tests and CI",
    weight: w.tests,
    value: d ? (d.tests.hasTests ? 0.6 : 0) + (d.tests.hasCi ? 0.4 : 0) : null,
    detail: d ? `${d.tests.hasTests ? "Test files found" : "No test files found"}; ${d.tests.hasCi ? "CI configuration found" : "no CI configuration"}.` : "Not measured in a quick scan.",
  });
  f.push({ key: "license", label: "License", weight: w.license, value: licenseFriendliness(input.license), detail: input.license.summary });

  const bytes = d ? d.codeBytes : input.sizeKb * 1024;
  f.push({
    key: "codeSize",
    label: "Code size",
    weight: w.codeSize,
    value: bytes <= 0 ? null : clamp(1 - Math.log10(Math.max(bytes, 50_000) / 50_000) / Math.log10(400)),
    detail: bytes <= 0 ? "Size unknown." : `About ${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB of ${d ? "source" : "repository data"}; smaller is easier to take over.`,
  });
  f.push({
    key: "complexity",
    label: "Complexity",
    weight: w.complexity,
    value: d ? clamp(1 - (d.languageCount - 1) * 0.2 - (d.fileCount && d.fileCount > 3000 ? 0.3 : 0)) : null,
    detail: d ? `${d.languageCount} language${d.languageCount === 1 ? "" : "s"}${d.fileCount ? `, ~${formatNumber(d.fileCount)} files` : ""}.` : "Not measured in a quick scan.",
  });
  f.push({
    key: "techDebt",
    label: "Technology debt",
    weight: w.techDebt,
    value: d ? clamp(1 - d.techDebtPoints / 12) : null,
    detail: d ? (d.techDebtPoints === 0 ? "No obsolete technologies detected." : `Obsolete technologies add ${d.techDebtPoints} debt points (12+ is the floor).`) : "Not measured in a quick scan.",
  });
  f.push({
    key: "dependencyHealth",
    label: "Ease of updating dependencies",
    weight: w.dependencyHealth,
    value: d ? d.dependencyHealth.healthyRatio : null,
    detail: d
      ? d.dependencyHealth.checked === 0
        ? "No supported dependency manifest was checked."
        : `${d.dependencyHealth.checked} dependencies checked: ${d.dependencyHealth.outdated.length} outdated, ${d.dependencyHealth.deprecated.length} deprecated.`
      : "Not measured in a quick scan.",
  });
  f.push({
    key: "community",
    label: "Community",
    weight: w.community,
    value: d ? 0.5 * logScale(d.contributors ?? 0, 100) + 0.5 * clamp(d.activeForks / 5) : null,
    detail: d ? `${d.contributors ?? "unknown number of"} contributors and ${d.activeForks} active fork${d.activeForks === 1 ? "" : "s"}.` : "Not measured in a quick scan.",
  });

  return combine(f);
}
