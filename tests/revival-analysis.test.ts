import { describe, expect, it } from "vitest";
import type { DependencyHealth, IssuesWorthSolving, SnapshotData, TechFinding } from "@/types/analysis";
import type { IssueItem, RepoMetadata } from "@/types/github";
import { ALGORITHM_VERSION, analyzeRepository, type AnalysisInput, type ForkAssessment } from "@/analysis/analyze";
import { calculateRevivalScore, QUICK_SCAN_CONFIDENCE, REVIVAL_WEIGHTS, type RevivalInput } from "@/analysis/revival-score";
import { assessLicense } from "@/analysis/license";
import { EMPTY_DEPENDENCY_HEALTH } from "@/analysis/dependencies";
import { assessDifficulty, calculateCommunityScore } from "@/analysis/rankings";
import { buildAbandonmentSignals, buildChallenges, buildCommunitySignals, buildRoadmap, buildSuggestions } from "@/analysis/insights";

const now = new Date("2026-10-01T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const iso = (d: number) => daysAgo(d).toISOString();

const mit = assessLicense({ spdx: "MIT", name: "MIT License" });
const noLicense = assessLicense(null);

const issue = (n: number, patch: Partial<IssueItem> = {}): IssueItem => ({
  number: n,
  title: `issue ${n}`,
  body: "",
  isPullRequest: false,
  state: "open",
  comments: 0,
  reactions: 0,
  labels: [],
  author: "u",
  createdAt: iso(100),
  updatedAt: iso(100),
  url: `https://github.com/o/r/issues/${n}`,
  draft: false,
  ...patch,
});

const finding = (patch: Partial<TechFinding> = {}): TechFinding => ({
  id: "x",
  name: "Thing 1",
  evidence: "thing@1",
  category: "library",
  severity: "medium",
  modern: "Thing 9",
  suggestion: "Upgrade Thing to 9",
  ...patch,
});

const health = (patch: Partial<DependencyHealth> = {}): DependencyHealth => ({ ...EMPTY_DEPENDENCY_HEALTH, ...patch });

const fork = (patch: Partial<ForkAssessment> = {}): ForkAssessment => ({
  fullName: "alice/r",
  stars: 10,
  pushedAt: iso(20),
  aheadBy: 42,
  behindBy: 0,
  recentCommits: 30,
  contributors: 2,
  lastCommitAt: iso(20),
  isActive: true,
  ...patch,
});

const repo = (patch: Partial<RepoMetadata> = {}): RepoMetadata => ({
  githubId: 1,
  owner: "o",
  name: "r",
  description: "A library",
  htmlUrl: "https://github.com/o/r",
  homepage: null,
  language: "JavaScript",
  topics: [],
  license: { spdx: "MIT", name: "MIT License" },
  stars: 2400,
  forks: 310,
  watchers: 80,
  openIssues: 57,
  sizeKb: 900,
  archived: false,
  disabled: false,
  isPrivate: false,
  isFork: false,
  parent: null,
  root: null,
  defaultBranch: "master",
  ownerType: "User",
  createdAt: "2015-01-01T00:00:00Z",
  pushedAt: iso(1200),
  ...patch,
});

const snapshot = (patch: Partial<SnapshotData> = {}): SnapshotData => ({
  languages: { JavaScript: 300_000, CSS: 20_000 },
  commitActivity: {
    monthly: [{ month: "2019-06", count: 60 }, { month: "2023-06", count: 2 }],
    contributors: [{ login: "maint", total: 900, lastCommitAt: iso(1200), recent12m: 0 }],
  },
  releases: [],
  releaseCount: 12,
  issueSample: [
    issue(1, { title: "Is this project still maintained?", comments: 12, reactions: 9 }),
    issue(2, { title: "Crash on startup", labels: ["bug"], comments: 3, reactions: 4 }),
    issue(3, { title: "Typo in README", labels: ["good first issue"] }),
    issue(4, { title: "Add dark mode", labels: ["enhancement"], comments: 30, reactions: 50 }),
    issue(5, { title: "Old question", createdAt: iso(900), updatedAt: iso(900) }),
    issue(6, { title: "Fix build", isPullRequest: true }),
    issue(7, { title: "Old PR", isPullRequest: true, createdAt: iso(800), updatedAt: iso(800) }),
    issue(8, { title: "closed crash", labels: ["bug"], state: "closed" }),
  ],
  topOpenIssues: [issue(1, { title: "Is this project still maintained?", comments: 12, reactions: 9 }), issue(20, { title: "Please revive this", createdAt: iso(700), updatedAt: iso(700) })],
  openPullRequests: [issue(6, { isPullRequest: true }), issue(7, { isPullRequest: true, createdAt: iso(800), updatedAt: iso(800) })],
  openPullRequestsTruncated: false,
  recentItemsByMonth: { issues: [], pullRequests: [] },
  treeFileCount: 180,
  readmeExcerpt: null,
  manifests: ["package.json"],
  totalCommits: 1400,
  totalContributors: 25,
  maintainerLastActiveAt: null,
  topContributor: "maint",
  downloadsLastMonth: 40_000,
  workflowRun: { conclusion: "failure", createdAt: iso(1210), name: "CI" },
  notes: ["Partial analysis: forks were not compared"],
  failed: [],
  ...patch,
});

const legacyPackage = JSON.stringify({ dependencies: { react: "^15.6.0", request: "^2.88.0" }, devDependencies: { webpack: "^3.0.0" } });

const deepInput = (patch: Partial<AnalysisInput> = {}): AnalysisInput => ({
  now,
  repo: repo(),
  lastCommitAt: daysAgo(1200),
  lastReleaseAt: daysAgo(1300),
  data: snapshot(),
  files: { "package.json": legacyPackage },
  paths: ["package.json", "README.md", "src/index.js", "test/index.test.js", ".travis.yml", "docs/guide.md", "CHANGELOG.md"],
  readme: `# r\n\n## Installation\n\nnpm i r\n\n## Usage\n\n\`\`\`js\nr()\n\`\`\`\n${"More words. ".repeat(150)}`,
  forks: [fork(), fork({ fullName: "bob/r", isActive: false, aheadBy: 0 })],
  dependencyHealth: health({
    ecosystem: "npm",
    checked: 3,
    total: 3,
    outdated: [{ name: "react", current: "^15.6.0", latest: "19.2.0", majorsBehind: 4 }, { name: "webpack", current: "^3.0.0", latest: "5.99.0", majorsBehind: 2 }],
    deprecated: [{ name: "request", message: "request has been deprecated" }],
    healthyRatio: 0,
  }),
  summary: "An old but loved library.",
  ...patch,
});

const quickInput = (patch: Partial<AnalysisInput> = {}): AnalysisInput => ({
  now,
  repo: repo(),
  lastCommitAt: null,
  lastReleaseAt: null,
  data: null,
  files: {},
  paths: [],
  readme: null,
  forks: [],
  dependencyHealth: EMPTY_DEPENDENCY_HEALTH,
  summary: null,
  ...patch,
});

const factor = (result: { factors: { key: string; value: number | null; available: boolean; detail: string; points: number }[] }, key: string) => {
  const f = result.factors.find((x) => x.key === key);
  if (!f) throw new Error(`missing factor ${key}`);
  return f;
};

const deepSignals: NonNullable<RevivalInput["deep"]> = {
  issuesLast12m: 10,
  maintenanceRequests: 1,
  pullRequestsLast12m: 2,
  docs: { score: 0.7, notes: ["Substantial README."] },
  tests: { hasTests: true, hasCi: true },
  codeBytes: 300_000,
  languageCount: 1,
  fileCount: 200,
  techDebtPoints: 3,
  dependencyHealth: health({ ecosystem: "npm", checked: 10, total: 10, healthyRatio: 0.5 }),
  contributors: 20,
  activeForks: 1,
};
const revivalInput = (deep: Partial<NonNullable<RevivalInput["deep"]>> | null = {}, patch: Partial<RevivalInput> = {}): RevivalInput => ({
  stars: 1000,
  forks: 100,
  downloadsLastMonth: 5000,
  license: mit,
  sizeKb: 500,
  deep: deep === null ? null : { ...deepSignals, ...deep },
  ...patch,
});
const DEEP_ONLY_KEYS = ["recentIssues", "maintenanceRequests", "recentPullRequests", "documentation", "tests", "complexity", "techDebt", "dependencyHealth", "community"];

describe("Revival Score factors", () => {
  it("has weights that add up to 100 and one factor per weight", () => {
    expect(Object.values(REVIVAL_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    const result = calculateRevivalScore(revivalInput());
    expect(result.factors.map((f) => f.key).sort()).toEqual(Object.keys(REVIVAL_WEIGHTS).sort());
    for (const f of result.factors) expect(f.weight).toBe(REVIVAL_WEIGHTS[f.key as keyof typeof REVIVAL_WEIGHTS]);
  });

  it("scores 100 with full confidence when every signal is at its ceiling", () => {
    const best = calculateRevivalScore({
      stars: 50_000,
      forks: 9_000,
      downloadsLastMonth: 5_000_000,
      license: mit,
      sizeKb: 10,
      deep: { ...deepSignals, issuesLast12m: 90, maintenanceRequests: 9, pullRequestsLast12m: 40, docs: { score: 1, notes: [] }, codeBytes: 20_000, techDebtPoints: 0, dependencyHealth: health({ checked: 5, total: 5, healthyRatio: 1 }), contributors: 500, activeForks: 8 },
    });
    expect(best.score).toBe(100);
    expect(best.confidence).toBe(100);
    expect(best.factors.every((f) => f.value === 1)).toBe(true);
  });

  it("stays low but within range for the worst case", () => {
    const worst = calculateRevivalScore({
      stars: 0,
      forks: 0,
      downloadsLastMonth: 0,
      license: noLicense,
      sizeKb: 0,
      deep: { ...deepSignals, issuesLast12m: 0, maintenanceRequests: 0, pullRequestsLast12m: 0, docs: { score: 0, notes: [] }, tests: { hasTests: false, hasCi: false }, codeBytes: 500_000_000, languageCount: 9, fileCount: 9000, techDebtPoints: 40, dependencyHealth: health({ checked: 5, total: 5, healthyRatio: 0 }), contributors: 0, activeForks: 0 },
    });
    expect(worst.confidence).toBe(100);
    expect(worst.score).toBe(1);
    expect(worst.factors.every((f) => f.value !== null && f.value >= 0 && f.value <= 1)).toBe(true);
  });

  it("reports points that add up to the score", () => {
    const result = calculateRevivalScore(revivalInput());
    expect(Math.abs(result.factors.reduce((s, f) => s + f.points, 0) - result.score)).toBeLessThan(1);
  });

  it("raises the score for each improving deep signal", () => {
    const base = calculateRevivalScore(revivalInput()).score;
    const better: Partial<NonNullable<RevivalInput["deep"]>>[] = [
      { issuesLast12m: 30 },
      { maintenanceRequests: 5 },
      { pullRequestsLast12m: 10 },
      { docs: { score: 1, notes: [] } },
      { techDebtPoints: 0 },
      { dependencyHealth: health({ checked: 10, total: 10, healthyRatio: 1 }) },
      { contributors: 100, activeForks: 5 },
    ];
    for (const patch of better) expect(calculateRevivalScore(revivalInput(patch)).score, JSON.stringify(patch)).toBeGreaterThan(base);
    const worse: Partial<NonNullable<RevivalInput["deep"]>>[] = [{ tests: { hasTests: false, hasCi: false } }, { codeBytes: 15_000_000 }, { languageCount: 5 }, { techDebtPoints: 12 }];
    for (const patch of worse) expect(calculateRevivalScore(revivalInput(patch)).score, JSON.stringify(patch)).toBeLessThan(base);
  });

  it("maps deep signals to the documented factor values", () => {
    const r = calculateRevivalScore(revivalInput({ issuesLast12m: 15, maintenanceRequests: 2, pullRequestsLast12m: 5, techDebtPoints: 6, languageCount: 3, fileCount: 5000 }));
    expect(factor(r, "recentIssues").value).toBe(0.5);
    expect(factor(r, "maintenanceRequests").value).toBe(0.4);
    expect(factor(r, "recentPullRequests").value).toBe(0.5);
    expect(factor(r, "techDebt").value).toBe(0.5);
    expect(factor(r, "complexity").value).toBeCloseTo(0.3, 3);
    expect(factor(r, "documentation").value).toBe(0.7);
    expect(factor(r, "dependencyHealth").value).toBe(0.5);
  });

  it("splits tests and CI 60/40", () => {
    const tests = (hasTests: boolean, hasCi: boolean) => factor(calculateRevivalScore(revivalInput({ tests: { hasTests, hasCi } })), "tests");
    expect(tests(true, true).value).toBe(1);
    expect(tests(true, false).value).toBe(0.6);
    expect(tests(false, true).value).toBe(0.4);
    expect(tests(false, false).value).toBe(0);
    expect(tests(false, false).detail).toBe("No test files found; no CI configuration.");
  });

  it("ranks licenses permissive > weak copyleft > copyleft > other > none", () => {
    const value = (license: Parameters<typeof assessLicense>[0]) => factor(calculateRevivalScore(revivalInput({}, { license: assessLicense(license) })), "license").value;
    expect([{ spdx: "MIT", name: "MIT" }, { spdx: "MPL-2.0", name: "MPL" }, { spdx: "GPL-3.0", name: "GPL" }, { spdx: "NOASSERTION", name: "Custom" }, null].map(value)).toEqual([1, 0.75, 0.6, 0.25, 0.05]);
  });

  it("treats small codebases as easiest and huge ones as hardest", () => {
    const size = (codeBytes: number) => factor(calculateRevivalScore(revivalInput({ codeBytes })), "codeSize").value;
    expect(size(10_000)).toBe(1);
    expect(size(50_000)).toBe(1);
    expect(size(1_000_000)).toBe(0.5);
    expect(size(20_000_000)).toBe(0);
    expect(size(900_000_000)).toBe(0);
  });

  it("leaves out signals that could not be measured instead of scoring them as zero", () => {
    const r = calculateRevivalScore(revivalInput({ codeBytes: 0, dependencyHealth: EMPTY_DEPENDENCY_HEALTH }, { downloadsLastMonth: null }));
    for (const key of ["codeSize", "dependencyHealth", "downloads"]) {
      expect(factor(r, key).available, key).toBe(false);
      expect(factor(r, key).points, key).toBe(0);
    }
    expect(r.confidence).toBe(100 - REVIVAL_WEIGHTS.codeSize - REVIVAL_WEIGHTS.dependencyHealth - REVIVAL_WEIGHTS.downloads);
    expect(factor(r, "dependencyHealth").detail).toBe("No supported dependency manifest was checked.");
    expect(factor(r, "downloads").detail).toBe("No package registry downloads found.");
    expect(factor(r, "codeSize").detail).toBe("Size unknown.");
  });

  it("counts unknown contributors as zero and pluralises forks", () => {
    const unknown = factor(calculateRevivalScore(revivalInput({ contributors: null, activeForks: 5 })), "community");
    expect(unknown.value).toBe(0.5);
    expect(unknown.detail).toBe("unknown number of contributors and 5 active forks.");
    expect(factor(calculateRevivalScore(revivalInput({ activeForks: 1 })), "community").detail).toBe("20 contributors and 1 active fork.");
  });

  it("explains every factor", () => {
    const r = calculateRevivalScore(revivalInput({ techDebtPoints: 0 }));
    expect(r.factors.every((f) => f.detail.length > 0 && f.label.length > 0)).toBe(true);
    expect(factor(r, "stars").detail).toContain("1,000 stars");
    expect(factor(r, "techDebt").detail).toBe("No obsolete technologies detected.");
    expect(factor(r, "codeSize").detail).toContain("0.29 MB of source");
  });
});

describe("Revival Score in a quick scan", () => {
  it("measures only stars, forks, license and size (plus downloads when known)", () => {
    const r = calculateRevivalScore(revivalInput(null, { downloadsLastMonth: null }));
    expect(r.factors.filter((f) => f.available).map((f) => f.key)).toEqual(["stars", "forks", "license", "codeSize"]);
    expect(r.confidence).toBe(REVIVAL_WEIGHTS.stars + REVIVAL_WEIGHTS.forks + REVIVAL_WEIGHTS.license + REVIVAL_WEIGHTS.codeSize);
    for (const key of DEEP_ONLY_KEYS) expect(factor(r, key).detail, key).toBe("Not measured in a quick scan.");
    expect(factor(r, "codeSize").detail).toContain("repository data");
    expect(calculateRevivalScore(revivalInput(null)).confidence).toBe(r.confidence + REVIVAL_WEIGHTS.downloads);
  });

  it("shrinks the score toward 50 in proportion to the missing confidence", () => {
    const top = calculateRevivalScore({ stars: 50_000, forks: 9_000, downloadsLastMonth: null, license: mit, deep: null, sizeKb: 10 });
    expect(top.confidence).toBe(38);
    expect(top.confidence).toBeLessThan(QUICK_SCAN_CONFIDENCE);
    expect(top.score).toBe(Math.round(50 + (50 * 38) / QUICK_SCAN_CONFIDENCE));
    const bottom = calculateRevivalScore({ stars: 0, forks: 0, downloadsLastMonth: null, license: noLicense, deep: null, sizeKb: 900_000 });
    expect(bottom.score).toBeGreaterThan(15);
    expect(bottom.score).toBeLessThan(50);
    // The factor breakdown still shows the unshrunk points.
    expect(top.factors.reduce((s, f) => s + f.points, 0)).toBeCloseTo(100, 0);
  });

  it("does not shrink a deep score", () => {
    const r = calculateRevivalScore(revivalInput());
    expect(r.confidence).toBeGreaterThanOrEqual(QUICK_SCAN_CONFIDENCE);
    expect(Math.abs(r.factors.reduce((s, f) => s + f.points, 0) - r.score)).toBeLessThan(1);
  });
});

describe("analyzeRepository: quick scan", () => {
  const result = analyzeRepository(quickInput());

  it("returns a QUICK result with no plan and no difficulty", () => {
    expect(result.algorithmVersion).toBe(ALGORITHM_VERSION);
    expect(result.depth).toBe("QUICK");
    expect(result.difficulty).toBeNull();
    expect(result.effort).toBeNull();
    expect(result.roadmap).toEqual([]);
    expect(result.modernizationSuggestions).toEqual([]);
    expect(result.technologies).toEqual([]);
    expect(result.notes).toEqual([]);
    expect(result.summary).toBeNull();
  });

  it("scores revival from metadata only", () => {
    expect(result.revival.confidence).toBe(38);
    expect(result.revival.score).toBeGreaterThan(50);
    expect(result.revival.score).toBeLessThan(85);
    for (const key of DEEP_ONLY_KEYS) expect(factor(result.revival, key).available, key).toBe(false);
  });

  it("uses pushedAt when the last commit is unknown", () => {
    expect(result.abandonmentSignals[0]).toEqual({ key: "no-commits", text: "No commits for 3.3 years", severity: "high" });
    const recent = analyzeRepository(quickInput({ repo: repo({ pushedAt: iso(5) }) }));
    expect(recent.abandonmentSignals[0]).toEqual({ key: "no-commits", text: "Recent commits found", severity: "low" });
    expect(recent.grave.score).toBeLessThan(result.grave.score);
  });

  it("does not claim missing tests, CI or demand it never measured", () => {
    expect(result.challenges).toEqual([]);
    expect(result.communitySignals).toEqual([{ key: "quiet", text: "Run the full analysis to measure recent demand.", positive: false }]);
    expect(result.buildSignal).toEqual({ source: "none", conclusion: null, at: null, note: "Run the full analysis for build hints." });
    expect(result.issuesWorthSolving).toEqual({ mostRequested: [], easyWins: [], criticalBugs: [], communityRequests: [], sampleSize: 0, openIssueCount: null });
    expect(result.abandonmentSignals.map((s) => s.key)).toEqual(["no-commits"]);
  });

  it("ignores dependency health passed without a snapshot and still flags the license", () => {
    const r = analyzeRepository(quickInput({ repo: repo({ license: null, archived: true }), dependencyHealth: deepInput().dependencyHealth }));
    expect(r.dependencyHealth).toEqual(EMPTY_DEPENDENCY_HEALTH);
    expect(r.licenseAssessment.kind).toBe("none");
    expect(r.challenges).toEqual([{ text: "No license: ask the owners before building on this code", severity: "high" }]);
    expect(r.abandonmentSignals.map((s) => s.key)).toEqual(["no-commits", "archived"]);
    expect(r.revival.score).toBeLessThan(result.revival.score);
  });

  it("caps the community score at 60 without deep data", () => {
    expect(result.communityScore).toBeLessThanOrEqual(60);
    expect(analyzeRepository(quickInput({ repo: repo({ forks: 90_000, openIssues: 9_000 }) })).communityScore).toBe(60);
  });
});

describe("analyzeRepository: deep analysis", () => {
  const result = analyzeRepository(deepInput());

  it("returns a DEEP result carrying summary and notes through", () => {
    expect(result.depth).toBe("DEEP");
    expect(result.summary).toBe("An old but loved library.");
    expect(result.notes).toEqual(["Partial analysis: forks were not compared"]);
    expect(result.licenseAssessment).toMatchObject({ kind: "permissive", forkFriendly: true });
    expect(result.dependencyHealth.checked).toBe(3);
  });

  it("derives the revival inputs from the snapshot", () => {
    const r = result.revival;
    expect(r.confidence).toBe(100);
    // Issues 1-4 and the closed #8 were opened this year; #5 is old and pull requests are counted separately.
    expect(factor(r, "recentIssues").detail).toBe("5 issues opened in the last 12 months (30+ is the ceiling).");
    expect(factor(r, "recentPullRequests").value).toBe(0.1);
    // #1 appears in both the sample and the top issues and is counted once, plus #20.
    expect(factor(r, "maintenanceRequests").detail).toBe("2 open issues ask about maintenance, updates or a successor.");
    expect(factor(r, "tests").value).toBe(1);
    expect(factor(r, "documentation").value).toBe(1);
    expect(factor(r, "dependencyHealth").value).toBe(0);
    expect(factor(r, "downloads").detail).toBe("40,000 npm downloads in the last month.");
    expect(factor(r, "complexity").detail).toBe("2 languages, ~180 files.");
    expect(factor(r, "community").detail).toBe("25 contributors and 1 active fork.");
    expect(factor(r, "codeSize").detail).toContain("0.31 MB of source");
    expect(factor(r, "techDebt").value).toBeLessThan(1);
    expect(r.score).toBeGreaterThan(40);
    expect(r.score).toBeLessThan(80);
  });

  it("finds the obsolete stack and turns it into suggestions and challenges", () => {
    expect(result.technologies.length).toBeGreaterThan(0);
    expect(result.modernizationSuggestions.length).toBeGreaterThan(0);
    const texts = result.modernizationSuggestions.map((s) => s.text);
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts).toContain("Replace deprecated package request");
    expect(texts).toContain("Upgrade react ^15.6.0 → 19.2.0");
    expect(texts).not.toContain("Create automated tests before touching the code");
    const challenges = result.challenges.map((c) => c.text);
    expect(challenges).toContain("Deprecated dependencies: request");
    expect(challenges).toContain("2 dependencies are two or more major versions behind (react, webpack)");
    expect(challenges.some((c) => /No automated tests|No CI/.test(c))).toBe(false);
  });

  it("builds a three-phase roadmap that starts with the active fork", () => {
    expect(result.roadmap.map((p) => p.title)).toEqual(["Phase 1 — Resurrection", "Phase 2 — Modernization", "Phase 3 — New release"]);
    const [p1, p2, p3] = result.roadmap.map((p) => p.steps);
    expect(p1[0]).toBe("Check alice/r first: it is already active and 42 commits ahead. Contributing there may beat starting over");
    expect(p1[1]).toBe("Fork the repository and keep the original license notice");
    expect(p1).toContain("Update dependencies, starting with deprecated ones");
    expect(p2).toContain("Fix critical bugs (#2)");
    expect(p2).toContain("Pick off easy wins to get contributors started (#3)");
    expect(p2.at(-1)).toBe("Refresh the README and document how to build and contribute");
    expect(p3).toEqual([
      "Resolve community requests (#4)",
      "Answer the people asking whether the project is alive",
      "Write a changelog covering everything since the last upstream release",
      "Publish a new release",
      "Register your fork as a Resurrection on GitHub Graveyard",
    ]);
  });

  it("sorts issues into buckets and reports the open issue count", () => {
    const w = result.issuesWorthSolving;
    expect(w.criticalBugs.map((i) => i.number)).toEqual([2]);
    expect(w.communityRequests.map((i) => i.number)).toEqual([1, 20]);
    expect(w.mostRequested.map((i) => i.number)).toEqual([4]);
    expect(w.easyWins.map((i) => i.number)).toEqual([3]);
    expect(w.openIssueCount).toBe(57);
    expect(w.sampleSize).toBe(6);
  });

  it("rates difficulty and effort from debt, dependencies and size", () => {
    expect(["MODERATE", "HARD", "EXTREME"]).toContain(result.difficulty);
    expect(result.effort).not.toBe("SMALL");
    const clean = analyzeRepository(deepInput({ files: {}, dependencyHealth: EMPTY_DEPENDENCY_HEALTH, paths: ["test/a.test.js", ".github/workflows/ci.yml"] }));
    expect(clean.difficulty).toBe("EASY");
    expect(clean.effort).toBe("SMALL");
    expect(clean.revival.score).toBeGreaterThan(0);
  });

  it("describes abandonment and demand", () => {
    expect(result.abandonmentSignals.map((s) => s.key)).toEqual(["no-commits", "last-release", "unanswered", "open-prs", "maintainer", "no-maintainers", "deps"]);
    expect(result.abandonmentSignals.find((s) => s.key === "open-prs")?.text).toBe("2 open pull requests (1 untouched for a year)");
    expect(result.abandonmentSignals.find((s) => s.key === "deps")).toEqual({ key: "deps", text: "3 of 3 checked dependencies are outdated or deprecated", severity: "high" });
    expect(result.communitySignals.map((s) => s.key)).toEqual(["issues-since-release", "recent-issues", "recent-prs", "maintenance-requests", "active-forks"]);
    expect(result.communitySignals.every((s) => s.positive)).toBe(true);
    expect(result.communityScore).toBeGreaterThan(0);
    expect(result.communityScore).toBeLessThanOrEqual(100);
  });

  it("reports the last workflow run as a hint", () => {
    expect(result.buildSignal).toMatchObject({ source: "github-actions", conclusion: "failure", at: iso(1210) });
    const none = analyzeRepository(deepInput({ data: snapshot({ workflowRun: null }) })).buildSignal;
    expect(none).toMatchObject({ source: "none", conclusion: null });
    expect(none.note).toContain("No GitHub Actions runs found");
    expect(analyzeRepository(deepInput({ data: snapshot({ workflowRun: null, failed: ["workflow runs"] }) })).buildSignal.note).toBe("CI runs could not be checked (GitHub request failed).");
  });

  it("scores a healthy, wanted project above a neglected one", () => {
    const wanted = analyzeRepository(
      deepInput({
        files: {},
        dependencyHealth: health({ ecosystem: "npm", checked: 8, total: 8, healthyRatio: 1 }),
        forks: [fork(), fork({ fullName: "c/r" }), fork({ fullName: "d/r" })],
        data: snapshot({ issueSample: Array.from({ length: 30 }, (_, n) => issue(n + 1, { title: "Please update", comments: 2 })) }),
      }),
    );
    const neglected = analyzeRepository(deepInput({ repo: repo({ stars: 12, forks: 0, license: null }), readme: null, paths: ["main.js"], forks: [], data: snapshot({ issueSample: [], topOpenIssues: [], openPullRequests: [], totalContributors: 1, downloadsLastMonth: null }) }));
    expect(wanted.revival.score).toBeGreaterThan(result.revival.score);
    expect(result.revival.score).toBeGreaterThan(neglected.revival.score);
    expect(wanted.communityScore).toBeGreaterThan(neglected.communityScore);
    expect(neglected.communitySignals.map((s) => s.key)).toEqual(["quiet"]);
    expect(neglected.roadmap[0].steps[0]).toBe("Contact the owners about licensing before forking");
    expect(neglected.challenges.map((c) => c.text)).toEqual(expect.arrayContaining(["No automated tests found, so regressions are hard to catch", "No CI configuration found", "No license: ask the owners before building on this code"]));
    expect(neglected.modernizationSuggestions.map((s) => s.text)).toEqual(expect.arrayContaining(["Add GitHub Actions to build and test every pull request", "Create automated tests before touching the code"]));
  });

  it("falls back when contributor and language data are missing", () => {
    const r = analyzeRepository(deepInput({ data: snapshot({ languages: {}, totalContributors: null, commitActivity: null, treeFileCount: null }) }));
    expect(factor(r.revival, "community").detail).toBe("unknown number of contributors and 1 active fork.");
    expect(factor(r.revival, "complexity").detail).toBe("1 language.");
    expect(factor(r.revival, "codeSize").available).toBe(false);
    expect(r.abandonmentSignals.map((s) => s.key)).not.toContain("no-maintainers");
  });

  it("is deterministic for the same input", () => {
    expect(analyzeRepository(deepInput())).toEqual(result);
  });
});

describe("revival plan builders", () => {
  const emptyIssues: IssuesWorthSolving = { mostRequested: [], easyWins: [], criticalBugs: [], communityRequests: [], sampleSize: 0, openIssueCount: 0 };
  const baseRoadmap = { fullName: "o/r", findings: [], dependencyHealth: EMPTY_DEPENDENCY_HEALTH, hasCi: true, hasTests: true, hasDeepData: true, issues: emptyIssues, activeForks: [], license: mit };

  it("keeps the minimal roadmap for a clean project", () => {
    expect(buildRoadmap(baseRoadmap).map((p) => p.steps)).toEqual([
      ["Fork the repository and keep the original license notice", "Get a clean build running on a current toolchain"],
      ["Refresh the README and document how to build and contribute"],
      ["Write a changelog covering everything since the last upstream release", "Publish a new release", "Register your fork as a Resurrection on GitHub Graveyard"],
    ]);
  });

  it("adds runtime, CI and test steps to phase 1 and keeps them out of phase 2", () => {
    const findings = [
      finding({ category: "runtime", suggestion: "Raise Node to 22" }),
      finding({ category: "ci", suggestion: "Migrate Travis to GitHub Actions" }),
      ...[1, 2, 3, 4, 5].map((n) => finding({ id: `l${n}`, suggestion: `Upgrade lib${n}` })),
    ];
    const [p1, p2] = buildRoadmap({ ...baseRoadmap, findings, hasTests: false, activeForks: [fork({ aheadBy: null })] }).map((p) => p.steps);
    expect(p1).toEqual([
      "Check alice/r first: it is already active. Contributing there may beat starting over",
      "Fork the repository and keep the original license notice",
      "Get a clean build running on a current toolchain",
      "Upgrade the runtime: Raise Node to 22",
      "Configure GitHub Actions to build and test every push",
      "Add a smoke test so you know when something breaks",
    ]);
    expect(p2).toEqual(["Upgrade lib1", "Upgrade lib2", "Upgrade lib3", "Upgrade lib4", "Refresh the README and document how to build and contribute"]);
  });

  it("lists at most three issue numbers per roadmap step", () => {
    const hl = (n: number) => ({ number: n, title: "t", url: "u", comments: 0, reactions: 0, labels: [], createdAt: iso(1), why: "w" });
    const many = [1, 2, 3, 4].map(hl);
    const [, p2, p3] = buildRoadmap({ ...baseRoadmap, issues: { ...emptyIssues, criticalBugs: many, easyWins: many, mostRequested: many } }).map((p) => p.steps);
    expect(p2).toContain("Fix critical bugs (#1, #2, #3)");
    expect(p2).toContain("Pick off easy wins to get contributors started (#1, #2, #3)");
    expect(p3[0]).toBe("Resolve community requests (#1, #2, #3)");
  });

  it("classifies, dedupes and caps suggestions", () => {
    const kinds = buildSuggestions({
      findings: [finding({ suggestion: "Migrate to Vite" }), finding({ suggestion: "Replace Moment with date-fns" }), finding({ suggestion: "Bump Node" }), finding({ suggestion: "Adopt TypeScript" }), finding({ suggestion: "Migrate to Vite" })],
      dependencyHealth: health({ checked: 2, outdated: [{ name: "a", current: "^1.0.0", latest: "2.0.0", majorsBehind: 1 }], deprecated: [{ name: "b", message: "gone" }] }),
      hasCi: false,
      hasTests: false,
      hasDeepData: true,
    });
    expect(kinds).toEqual([
      { text: "Migrate to Vite", kind: "migrate" },
      { text: "Replace Moment with date-fns", kind: "replace" },
      { text: "Bump Node", kind: "upgrade" },
      { text: "Adopt TypeScript", kind: "migrate" },
      { text: "Replace deprecated package b", kind: "replace" },
      { text: "Upgrade a ^1.0.0 → 2.0.0", kind: "upgrade" },
      { text: "Add GitHub Actions to build and test every pull request", kind: "add" },
      { text: "Create automated tests before touching the code", kind: "add" },
    ]);
    const many = buildSuggestions({ findings: Array.from({ length: 20 }, (_, n) => finding({ suggestion: `Upgrade lib${n}` })), dependencyHealth: EMPTY_DEPENDENCY_HEALTH, hasCi: true, hasTests: true, hasDeepData: true });
    expect(many).toHaveLength(12);
    expect(buildSuggestions({ findings: [], dependencyHealth: EMPTY_DEPENDENCY_HEALTH, hasCi: false, hasTests: false, hasDeepData: false })).toEqual([]);
  });

  it("lists challenges by cause and skips low-severity findings", () => {
    const challenges = buildChallenges({
      findings: [finding({ severity: "low", name: "Minor" }), finding({ severity: "high", name: "AngularJS", evidence: "angular@1.5" })],
      dependencyHealth: health({ checked: 3, outdated: [{ name: "a", current: "1", latest: "3", majorsBehind: 2 }, { name: "c", current: "1", latest: "2", majorsBehind: 1 }] }),
      hasTests: false,
      hasCi: false,
      license: assessLicense({ spdx: "NOASSERTION", name: "Custom" }),
      codeBytes: 11 * 1024 * 1024,
      hasDeepData: true,
    });
    expect(challenges).toEqual([
      { text: "AngularJS is obsolete (angular@1.5)", severity: "high" },
      { text: "1 dependency is two or more major versions behind (a)", severity: "medium" },
      { text: "No automated tests found, so regressions are hard to catch", severity: "medium" },
      { text: "No CI configuration found", severity: "low" },
      { text: "License terms need a careful read before forking", severity: "high" },
      { text: "Large codebase: a full modernization is a long project", severity: "medium" },
    ]);
    expect(buildChallenges({ findings: [], dependencyHealth: EMPTY_DEPENDENCY_HEALTH, hasTests: true, hasCi: true, license: mit, codeBytes: 1000, hasDeepData: true })).toEqual([]);
  });

  it("words community signals for one and many, and flags inexact counts", () => {
    const args = { now, lastReleaseAt: daysAgo(200), forks: [], maintenanceRequests: 0, stars: 10, openIssues: 5 };
    const one = buildCommunitySignals({ ...args, data: snapshot({ issueSample: [issue(1, { createdAt: iso(50) }), issue(2, { createdAt: iso(400) }), issue(3, { isPullRequest: true, createdAt: iso(10) })] }), maintenanceRequests: 1, forks: [fork()] });
    expect(one.map((s) => s.text)).toEqual([
      "1 issue was created after the final release.",
      "1 issue was opened in the last 12 months.",
      "1 pull request was opened in the last 12 months.",
      "1 open issue asks whether the project is still maintained or can be taken over.",
      "1 fork received commits during the last year.",
    ]);
    // The sample does not reach back to the release, so the count is a lower bound.
    const partial = buildCommunitySignals({ ...args, data: snapshot({ issueSample: [issue(1, { createdAt: iso(50) }), issue(2, { createdAt: iso(60) })] }) });
    expect(partial[0].text).toBe("At least 2 issues were created after the final release.");
    expect(buildCommunitySignals({ ...args, data: snapshot({ issueSample: [] }) })).toEqual([{ key: "quiet", text: "Little recent demand detected. The community looks as quiet as the code.", positive: false }]);
  });

  it("grades abandonment signals by severity", () => {
    const base = { now, daysSinceCommit: 200, daysSinceRelease: 400, archived: false, data: null, readmeNotice: null, dependencyHealth: EMPTY_DEPENDENCY_HEALTH, unanswered: null, activeContributors12m: null };
    expect(buildAbandonmentSignals(base).map((s) => [s.key, s.severity])).toEqual([["no-commits", "medium"], ["last-release", "medium"]]);
    const severe = buildAbandonmentSignals({
      ...base,
      daysSinceCommit: 800,
      daysSinceRelease: null,
      archived: true,
      data: snapshot({ openPullRequests: Array.from({ length: 6 }, (_, n) => issue(n, { isPullRequest: true, updatedAt: iso(500) })), openPullRequestsTruncated: true, maintainerLastActiveAt: iso(3) }),
      readmeNotice: { level: "soft", matches: ["looking for maintainers"] },
      unanswered: 25,
      activeContributors12m: 2,
      dependencyHealth: health({ checked: 4, outdated: [{ name: "a", current: "1", latest: "2", majorsBehind: 1 }] }),
    });
    expect(severe).toEqual([
      { key: "no-commits", text: "No commits for 2.2 years", severity: "high" },
      { key: "no-releases", text: "No GitHub releases have been published", severity: "low" },
      { key: "archived", text: "Repository is archived (read-only)", severity: "high" },
      { key: "readme", text: "README says “looking for maintainers”", severity: "medium" },
      { key: "unanswered", text: "25 open issues have no response", severity: "high" },
      { key: "open-prs", text: "6+ open pull requests (6 untouched for a year)", severity: "high" },
      { key: "deps", text: "1 of 4 checked dependencies are outdated or deprecated", severity: "medium" },
    ]);
  });
});

describe("difficulty and community rankings", () => {
  const base = { findings: [], dependencyHealth: EMPTY_DEPENDENCY_HEALTH, hasTests: true, hasCi: true, codeBytes: 100_000, languageCount: 1, daysSinceActivity: 400 };

  it("maps points to difficulty bands", () => {
    const withPoints = (n: number) => assessDifficulty({ ...base, findings: Array.from({ length: n }, () => finding({ severity: "low" })) });
    expect([0, 3, 4, 7, 8, 12, 13].map((n) => withPoints(n).difficulty)).toEqual(["EASY", "EASY", "MODERATE", "MODERATE", "HARD", "HARD", "EXTREME"]);
    expect([0, 4, 8, 13].map((n) => withPoints(n).effort)).toEqual(["SMALL", "MEDIUM", "LARGE", "LARGE"]);
  });

  it("adds points for each risk", () => {
    expect(assessDifficulty(base).points).toBe(0);
    expect(assessDifficulty({ ...base, hasTests: false, hasCi: false }).points).toBe(3);
    expect(assessDifficulty({ ...base, codeBytes: 600 * 1024 }).points).toBe(1);
    expect(assessDifficulty({ ...base, codeBytes: 3 * 1024 * 1024 }).points).toBe(2);
    expect(assessDifficulty({ ...base, codeBytes: 11 * 1024 * 1024 })).toMatchObject({ points: 3, difficulty: "EASY", effort: "LARGE" });
    expect(assessDifficulty({ ...base, languageCount: 4, daysSinceActivity: 2000 }).points).toBe(2);
    expect(assessDifficulty({ ...base, findings: [finding({ severity: "high" }), finding({ severity: "medium" })] }).points).toBe(5);
    const deps = health({
      checked: 9,
      deprecated: Array.from({ length: 5 }, (_, n) => ({ name: `d${n}`, message: "" })),
      outdated: [...Array.from({ length: 5 }, (_, n) => ({ name: `o${n}`, current: "1", latest: "3", majorsBehind: 2 })), { name: "minor", current: "1", latest: "2", majorsBehind: 1 }],
    });
    expect(assessDifficulty({ ...base, dependencyHealth: deps }).points).toBe(6);
    expect(assessDifficulty({ ...base, codeBytes: 600 * 1024 }).effort).toBe("MEDIUM");
  });

  it("scores community demand from deep signals", () => {
    const deep = { issuesLast12m: 0, pullRequestsLast12m: 0, activeForks: 0, maintenanceRequests: 0, recentlyUpdatedShare: 0 };
    expect(calculateCommunityScore({ deep, forks: 9000, openIssues: 900 })).toBe(0);
    expect(calculateCommunityScore({ deep: { issuesLast12m: 60, pullRequestsLast12m: 20, activeForks: 9, maintenanceRequests: 9, recentlyUpdatedShare: 1 }, forks: 0, openIssues: 0 })).toBe(100);
    expect(calculateCommunityScore({ deep: { ...deep, issuesLast12m: 15 }, forks: 0, openIssues: 0 })).toBe(15);
    expect(calculateCommunityScore({ deep: { ...deep, activeForks: 5 }, forks: 0, openIssues: 0 })).toBe(25);
    expect(calculateCommunityScore({ deep: null, forks: 0, openIssues: 0 })).toBe(0);
    expect(calculateCommunityScore({ deep: null, forks: 5000, openIssues: 5000 })).toBe(60);
  });
});
