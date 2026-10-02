import type { Challenge, CommunitySignal, DependencyHealth, IssuesWorthSolving, LicenseAssessment, RoadmapPhase, Signal, Suggestion, TechFinding } from "@/types/analysis";
import type { SnapshotData } from "@/types/analysis";
import type { ForkAssessment } from "@/analysis/analyze";
import { formatYears } from "@/lib/utils";

interface SignalContext {
  now: Date;
  daysSinceCommit: number;
  daysSinceRelease: number | null;
  archived: boolean;
  data: SnapshotData | null;
  readmeNotice: { level: "none" | "soft" | "strong"; matches: string[] } | null;
  dependencyHealth: DependencyHealth;
  unanswered: number | null;
  activeContributors12m: number | null;
}

export function buildAbandonmentSignals(c: SignalContext): Signal[] {
  const out: Signal[] = [];
  const years = (days: number) => formatYears(Math.round(days));
  out.push({
    key: "no-commits",
    text: c.daysSinceCommit < 30 ? "Recent commits found" : `No commits for ${years(c.daysSinceCommit)}`,
    severity: c.daysSinceCommit >= 730 ? "high" : c.daysSinceCommit >= 180 ? "medium" : "low",
  });
  if (c.daysSinceRelease !== null) {
    out.push({ key: "last-release", text: `Last release was ${years(c.daysSinceRelease)} ago`, severity: c.daysSinceRelease >= 730 ? "high" : c.daysSinceRelease >= 365 ? "medium" : "low" });
  } else if (c.data) {
    out.push({ key: "no-releases", text: "No GitHub releases have been published", severity: "low" });
  }
  if (c.archived) out.push({ key: "archived", text: "Repository is archived (read-only)", severity: "high" });
  if (c.readmeNotice && c.readmeNotice.level !== "none") {
    out.push({ key: "readme", text: `README says “${c.readmeNotice.matches[0]}”`, severity: c.readmeNotice.level === "strong" ? "high" : "medium" });
  }
  if (c.unanswered !== null && c.unanswered > 0) {
    out.push({ key: "unanswered", text: `${c.unanswered}${c.data && c.data.issueSample.filter((i) => !i.isPullRequest && i.state === "open").length >= 200 ? "+" : ""} open issues have no response`, severity: c.unanswered >= 20 ? "high" : "medium" });
  }
  if (c.data) {
    const open = c.data.openPullRequests.length;
    if (open > 0) {
      const stale = c.data.openPullRequests.filter((p) => c.now.getTime() - new Date(p.updatedAt).getTime() > 365 * 86_400_000).length;
      out.push({ key: "open-prs", text: `${open}${c.data.openPullRequestsTruncated ? "+" : ""} open pull requests${stale > 0 ? ` (${stale} untouched for a year)` : ""}`, severity: stale >= 5 ? "high" : "medium" });
    }
    if (c.data.maintainerLastActiveAt === null && c.data.topContributor) {
      out.push({ key: "maintainer", text: `Top contributor @${c.data.topContributor} has no public GitHub activity in the last 90 days`, severity: "medium" });
    }
  }
  if (c.activeContributors12m === 0) out.push({ key: "no-maintainers", text: "No active maintainers detected in the last 12 months", severity: "high" });
  const dh = c.dependencyHealth;
  if (dh.checked > 0 && dh.outdated.length + dh.deprecated.length > 0) {
    out.push({ key: "deps", text: `${new Set([...dh.outdated.map((o) => o.name), ...dh.deprecated.map((d) => d.name)]).size} of ${dh.checked} checked dependencies are outdated or deprecated`, severity: dh.deprecated.length > 0 ? "high" : "medium" });
  }
  return out;
}

export function buildCommunitySignals(args: {
  now: Date;
  data: SnapshotData | null;
  lastReleaseAt: Date | null;
  forks: ForkAssessment[];
  maintenanceRequests: number;
  stars: number;
  openIssues: number;
}): CommunitySignal[] {
  const { now, data, forks } = args;
  const out: CommunitySignal[] = [];
  const yearAgo = now.getTime() - 365 * 86_400_000;

  if (data) {
    const items = data.issueSample;
    const issues = items.filter((i) => !i.isPullRequest);
    if (args.lastReleaseAt) {
      const since = issues.filter((i) => new Date(i.createdAt) > args.lastReleaseAt!).length;
      const oldest = issues.length ? Math.min(...issues.map((i) => new Date(i.createdAt).getTime())) : Infinity;
      const exact = oldest <= args.lastReleaseAt.getTime();
      if (since > 0) out.push({ key: "issues-since-release", text: `${exact ? since : `At least ${since}`} ${since === 1 ? "issue was" : "issues were"} created after the final release.`, positive: true });
    }
    const recentIssues = issues.filter((i) => new Date(i.createdAt).getTime() > yearAgo).length;
    if (recentIssues > 0) out.push({ key: "recent-issues", text: `${recentIssues} ${recentIssues === 1 ? "issue was" : "issues were"} opened in the last 12 months.`, positive: true });
    const recentPrs = items.filter((i) => i.isPullRequest && new Date(i.createdAt).getTime() > yearAgo).length;
    if (recentPrs > 0) out.push({ key: "recent-prs", text: `${recentPrs} pull ${recentPrs === 1 ? "request was" : "requests were"} opened in the last 12 months.`, positive: true });
  }
  if (args.maintenanceRequests > 0) {
    out.push({ key: "maintenance-requests", text: `${args.maintenanceRequests} open ${args.maintenanceRequests === 1 ? "issue asks" : "issues ask"} whether the project is still maintained or can be taken over.`, positive: true });
  }
  const active = forks.filter((f) => f.isActive);
  if (active.length > 0) out.push({ key: "active-forks", text: `${active.length} ${active.length === 1 ? "fork received" : "forks received"} commits during the last year.`, positive: true });
  if (out.length === 0) {
    out.push({
      key: "quiet",
      text: data ? "Little recent demand detected. The community looks as quiet as the code." : "Run the full analysis to measure recent demand.",
      positive: false,
    });
  }
  return out;
}

export function buildChallenges(args: {
  findings: TechFinding[];
  dependencyHealth: DependencyHealth;
  hasTests: boolean;
  hasCi: boolean;
  license: LicenseAssessment;
  codeBytes: number;
  hasDeepData: boolean;
}): Challenge[] {
  const out: Challenge[] = [];
  for (const f of args.findings.filter((x) => x.severity !== "low").slice(0, 5)) {
    out.push({ text: `${f.name} is obsolete (${f.evidence})`, severity: f.severity });
  }
  if (args.dependencyHealth.deprecated.length > 0) {
    out.push({ text: `Deprecated dependencies: ${args.dependencyHealth.deprecated.slice(0, 4).map((d) => d.name).join(", ")}`, severity: "high" });
  }
  const behind = args.dependencyHealth.outdated.filter((o) => o.majorsBehind >= 2);
  if (behind.length > 0) {
    out.push({ text: `${behind.length} dependenc${behind.length === 1 ? "y is" : "ies are"} two or more major versions behind (${behind.slice(0, 3).map((o) => o.name).join(", ")})`, severity: "medium" });
  }
  if (args.hasDeepData && !args.hasTests) out.push({ text: "No automated tests found, so regressions are hard to catch", severity: "medium" });
  if (args.hasDeepData && !args.hasCi) out.push({ text: "No CI configuration found", severity: "low" });
  if (!args.license.forkFriendly) out.push({ text: args.license.kind === "none" ? "No license: ask the owners before building on this code" : "License terms need a careful read before forking", severity: "high" });
  if (args.codeBytes > 10 * 1024 * 1024) out.push({ text: "Large codebase: a full modernization is a long project", severity: "medium" });
  return out;
}

export function buildSuggestions(args: { findings: TechFinding[]; dependencyHealth: DependencyHealth; hasCi: boolean; hasTests: boolean; hasDeepData: boolean }): Suggestion[] {
  const out: Suggestion[] = [];
  for (const f of args.findings) {
    const kind: Suggestion["kind"] = /^(Migrate|Rewrite|Convert|Port)/.test(f.suggestion) ? "migrate" : /^Replace/.test(f.suggestion) ? "replace" : /^(Upgrade|Raise|Bump|Update)/.test(f.suggestion) ? "upgrade" : "migrate";
    out.push({ text: f.suggestion, kind });
  }
  for (const d of args.dependencyHealth.deprecated.slice(0, 4)) out.push({ text: `Replace deprecated package ${d.name}`, kind: "replace" });
  for (const o of args.dependencyHealth.outdated.filter((x) => x.majorsBehind >= 1).slice(0, 4)) out.push({ text: `Upgrade ${o.name} ${o.current} → ${o.latest}`, kind: "upgrade" });
  if (args.hasDeepData && !args.hasCi) out.push({ text: "Add GitHub Actions to build and test every pull request", kind: "add" });
  if (args.hasDeepData && !args.hasTests) out.push({ text: "Create automated tests before touching the code", kind: "add" });
  const seen = new Set<string>();
  return out.filter((s) => (seen.has(s.text) ? false : (seen.add(s.text), true))).slice(0, 12);
}

export function buildRoadmap(args: {
  fullName: string;
  findings: TechFinding[];
  dependencyHealth: DependencyHealth;
  hasCi: boolean;
  hasTests: boolean;
  hasDeepData: boolean;
  issues: IssuesWorthSolving;
  activeForks: ForkAssessment[];
  license: LicenseAssessment;
}): RoadmapPhase[] {
  const p1: string[] = [];
  if (args.activeForks.length > 0) {
    const top = args.activeForks[0];
    p1.push(`Check ${top.fullName} first: it is already active${top.aheadBy ? ` and ${top.aheadBy} commits ahead` : ""}. Contributing there may beat starting over`);
  }
  p1.push(args.license.forkFriendly ? "Fork the repository and keep the original license notice" : "Contact the owners about licensing before forking");
  p1.push("Get a clean build running on a current toolchain");
  const runtime = args.findings.find((f) => f.category === "runtime" || f.category === "language");
  if (runtime) p1.push(`Upgrade the runtime: ${runtime.suggestion}`);
  if (args.dependencyHealth.checked > 0) p1.push("Update dependencies, starting with deprecated ones");
  if (!args.hasCi || args.findings.some((f) => f.category === "ci")) p1.push("Configure GitHub Actions to build and test every push");
  if (args.hasDeepData && !args.hasTests) p1.push("Add a smoke test so you know when something breaks");

  const p2: string[] = args.findings.filter((f) => f.category !== "runtime" && f.category !== "ci").slice(0, 4).map((f) => f.suggestion);
  if (args.issues.criticalBugs.length > 0) p2.push(`Fix critical bugs (${args.issues.criticalBugs.slice(0, 3).map((i) => `#${i.number}`).join(", ")})`);
  if (args.issues.easyWins.length > 0) p2.push(`Pick off easy wins to get contributors started (${args.issues.easyWins.slice(0, 3).map((i) => `#${i.number}`).join(", ")})`);
  p2.push("Refresh the README and document how to build and contribute");

  const p3: string[] = [];
  if (args.issues.mostRequested.length > 0) p3.push(`Resolve community requests (${args.issues.mostRequested.slice(0, 3).map((i) => `#${i.number}`).join(", ")})`);
  if (args.issues.communityRequests.length > 0) p3.push("Answer the people asking whether the project is alive");
  p3.push("Write a changelog covering everything since the last upstream release");
  p3.push("Publish a new release");
  p3.push("Register your fork as a Resurrection on GitHub Graveyard");

  return [
    { title: "Phase 1 — Resurrection", steps: p1 },
    { title: "Phase 2 — Modernization", steps: p2 },
    { title: "Phase 3 — New release", steps: p3 },
  ];
}
