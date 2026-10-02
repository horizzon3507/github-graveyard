import type { MonthlyCount } from "@/types/github";
import type { ScoreResult } from "@/types/analysis";
import { clamp, formatYears } from "@/lib/utils";
import { combine, type FactorDefinition } from "@/analysis/scoring";

export interface GraveInput {
  now: Date;
  lastActivityAt: Date;
  archived: boolean;
  releases: { lastReleaseAt: Date | null; count: number } | null;
  issues: { openIssues: number; unanswered: number; sampleSize: number } | null;
  pullRequests: { open: number; stale: number; truncated: boolean } | null;
  monthlyCommits: MonthlyCount[] | null;
  maintainerLastActiveAt: Date | null | undefined;
  readmeNotice: { level: "none" | "soft" | "strong"; matches: string[] } | null;
  activeContributors12m: number | null;
}

export const GRAVE_WEIGHTS = {
  lastCommit: 30,
  lastRelease: 12,
  unansweredIssues: 12,
  stalePullRequests: 8,
  commitDecline: 12,
  maintainerActivity: 8,
  readmeNotice: 8,
  archived: 5,
  activeContributors: 5,
} as const;

const STRONG_NOTICE =
  /(no longer (actively )?(maintained|supported|developed)|not (actively )?maintained|unmaintained|deprecated|abandon(ed|ware)|end[- ]of[- ]life|\bEOL\b|discontinued|this (project|repo(sitory)?) is (dead|archived))/i;
const SOFT_NOTICE =
  /(looking for (a )?(new )?(co-?)?maintainers?|seeking (a )?(new )?maintainers?|maintainers? wanted|help wanted.*maintain|moved to|has moved|superseded by|successor|replaced by|use .{1,40} instead|on hiatus|minimal maintenance|maintenance mode)/i;

export function detectAbandonmentNotice(readme: string | null): GraveInput["readmeNotice"] {
  if (readme === null) return null;
  const head = readme.slice(0, 6000);
  const strong = head.match(STRONG_NOTICE);
  if (strong) return { level: "strong", matches: [strong[0]] };
  const soft = head.match(SOFT_NOTICE);
  if (soft) return { level: "soft", matches: [soft[0]] };
  return { level: "none", matches: [] };
}

/** Time curve: 0 when fresh, 1 at `horizonDays`, logarithmic in between so the first months matter most. */
export function ageCurve(days: number, horizonDays = 1825, softDays = 90): number {
  return clamp(Math.log(1 + days / softDays) / Math.log(1 + horizonDays / softDays));
}

export function commitDeclineValue(monthly: MonthlyCount[]): { value: number; recent: number; peak: number } | null {
  if (monthly.length === 0) return null;
  const counts = monthly.map((m) => m.count);
  let peak = 0;
  for (let i = 0; i < counts.length; i++) {
    const window = counts.slice(i, i + 12).reduce((a, b) => a + b, 0);
    peak = Math.max(peak, window);
  }
  if (peak === 0) return null;
  const recent = counts.slice(-12).reduce((a, b) => a + b, 0);
  return { value: clamp(1 - recent / peak), recent, peak };
}

export function calculateGraveScore(input: GraveInput): ScoreResult {
  const { now } = input;
  const days = Math.max(0, (now.getTime() - input.lastActivityAt.getTime()) / 86_400_000);
  const w = GRAVE_WEIGHTS;
  const factors: FactorDefinition[] = [];

  factors.push({
    key: "lastCommit",
    label: "Time since last commit",
    weight: w.lastCommit,
    value: ageCurve(days),
    detail: `Last activity ${formatYears(Math.round(days))} ago.`,
  });

  if (input.releases) {
    const { lastReleaseAt, count } = input.releases;
    if (lastReleaseAt) {
      const d = (now.getTime() - lastReleaseAt.getTime()) / 86_400_000;
      factors.push({ key: "lastRelease", label: "Time since last release", weight: w.lastRelease, value: ageCurve(d), detail: `Last release ${formatYears(Math.round(d))} ago (${count} releases).` });
    } else {
      factors.push({ key: "lastRelease", label: "Time since last release", weight: w.lastRelease, value: 0.5, detail: "No GitHub releases published, so this factor stays neutral." });
    }
  } else {
    factors.push({ key: "lastRelease", label: "Time since last release", weight: w.lastRelease, value: null, detail: "Not measured in a quick scan." });
  }

  if (input.issues) {
    const { unanswered, sampleSize, openIssues } = input.issues;
    const ratio = sampleSize === 0 ? 0 : unanswered / sampleSize;
    const volume = clamp(unanswered / 50);
    factors.push({
      key: "unansweredIssues",
      label: "Issues without a response",
      weight: w.unansweredIssues,
      value: ratio * 0.5 + volume * 0.5,
      detail: `${unanswered} of ${sampleSize} sampled open issues have no comments (${openIssues} open in total).`,
    });
  } else {
    factors.push({ key: "unansweredIssues", label: "Issues without a response", weight: w.unansweredIssues, value: null, detail: "Not measured in a quick scan." });
  }

  if (input.pullRequests) {
    const { open, stale, truncated } = input.pullRequests;
    const ratio = open === 0 ? 0 : stale / open;
    factors.push({
      key: "stalePullRequests",
      label: "Abandoned pull requests",
      weight: w.stalePullRequests,
      value: ratio * clamp(open / 10),
      detail: `${stale} of ${open}${truncated ? "+" : ""} open pull requests have had no update for a year.`,
    });
  } else {
    factors.push({ key: "stalePullRequests", label: "Abandoned pull requests", weight: w.stalePullRequests, value: null, detail: "Not measured in a quick scan." });
  }

  const decline = input.monthlyCommits ? commitDeclineValue(input.monthlyCommits) : null;
  factors.push({
    key: "commitDecline",
    label: "Drop in commit frequency",
    weight: w.commitDecline,
    value: decline ? decline.value : null,
    detail: decline
      ? `${decline.recent} commits in the last 12 months versus ${decline.peak} in the busiest 12 months.`
      : "Commit history was not available.",
  });

  if (input.maintainerLastActiveAt === undefined) {
    factors.push({ key: "maintainerActivity", label: "Maintainer activity", weight: w.maintainerActivity, value: null, detail: "Maintainer activity was not measured." });
  } else if (input.maintainerLastActiveAt === null) {
    factors.push({ key: "maintainerActivity", label: "Maintainer activity", weight: w.maintainerActivity, value: 0.9, detail: "The top contributor has no public GitHub activity in the last 90 days (GitHub only exposes 90 days of events)." });
  } else {
    const d = (now.getTime() - input.maintainerLastActiveAt.getTime()) / 86_400_000;
    factors.push({
      key: "maintainerActivity",
      label: "Maintainer activity",
      weight: w.maintainerActivity,
      value: clamp(d / 90) * 0.5,
      detail: `Top contributor was last seen on GitHub ${Math.round(d)} days ago (public events, 90-day window).`,
    });
  }

  if (input.readmeNotice) {
    const { level, matches } = input.readmeNotice;
    factors.push({
      key: "readmeNotice",
      label: "README mentions abandonment",
      weight: w.readmeNotice,
      value: level === "strong" ? 1 : level === "soft" ? 0.6 : 0,
      detail: level === "none" ? "No abandonment notice found in the README." : `README contains "${matches[0]}".`,
    });
  } else {
    factors.push({ key: "readmeNotice", label: "README mentions abandonment", weight: w.readmeNotice, value: null, detail: "README was not analysed." });
  }

  factors.push({
    key: "archived",
    label: "Repository archived",
    weight: w.archived,
    value: input.archived ? 1 : 0,
    detail: input.archived ? "The owner archived this repository (read-only)." : "Repository is not archived.",
  });

  if (input.activeContributors12m === null) {
    factors.push({ key: "activeContributors", label: "Active contributors", weight: w.activeContributors, value: null, detail: "Contributor history was not available." });
  } else {
    const n = input.activeContributors12m;
    const value = n === 0 ? 1 : n === 1 ? 0.6 : n === 2 ? 0.3 : n <= 4 ? 0.1 : 0;
    factors.push({ key: "activeContributors", label: "Active contributors", weight: w.activeContributors, value, detail: `${n} contributor${n === 1 ? "" : "s"} committed in the last 12 months.` });
  }

  const result = combine(factors);
  if (input.archived && result.score < 50) return { ...result, score: 50 };
  return result;
}
