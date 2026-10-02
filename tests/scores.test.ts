import { describe, expect, it } from "vitest";
import { calculateGraveScore, detectAbandonmentNotice, ageCurve } from "@/analysis/grave-score";
import { calculateRevivalScore } from "@/analysis/revival-score";
import { assessLicense } from "@/analysis/license";
import { calculateHiddenGemScore } from "@/analysis/rankings";
import { EMPTY_DEPENDENCY_HEALTH } from "@/analysis/dependencies";

const now = new Date("2026-10-01T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

const baseGrave = { now, archived: false, releases: null, issues: null, pullRequests: null, monthlyCommits: null, maintainerLastActiveAt: undefined, readmeNotice: null, activeContributors12m: null };

describe("Grave Score", () => {
  it("grows with time since the last commit", () => {
    const scores = [30, 200, 400, 800, 2000].map((d) => calculateGraveScore({ ...baseGrave, lastActivityAt: daysAgo(d) }).score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    expect(scores[0]).toBeLessThan(20);
    expect(scores[4]).toBeGreaterThan(85);
  });

  it("stays within 0-100 and reports weight coverage as confidence", () => {
    const quick = calculateGraveScore({ ...baseGrave, lastActivityAt: daysAgo(5000) });
    expect(quick.score).toBeLessThanOrEqual(100);
    expect(quick.confidence).toBe(35);
    const full = calculateGraveScore({
      now,
      lastActivityAt: daysAgo(900),
      archived: true,
      releases: { lastReleaseAt: daysAgo(1000), count: 5 },
      issues: { openIssues: 80, unanswered: 40, sampleSize: 80 },
      pullRequests: { open: 20, stale: 18, truncated: false },
      monthlyCommits: [{ month: "2020-01", count: 40 }, { month: "2025-01", count: 0 }],
      maintainerLastActiveAt: null,
      readmeNotice: { level: "strong", matches: ["no longer maintained"] },
      activeContributors12m: 0,
    });
    expect(full.confidence).toBe(100);
    expect(full.score).toBeGreaterThan(70);
    expect(Math.abs(full.factors.reduce((s, f) => s + f.points, 0) - full.score)).toBeLessThan(1);
  });

  it("floors archived repositories at 50", () => {
    expect(calculateGraveScore({ ...baseGrave, archived: true, lastActivityAt: daysAgo(10) }).score).toBeGreaterThanOrEqual(50);
  });

  it("detects abandonment notices in READMEs", () => {
    expect(detectAbandonmentNotice("# Foo\n\nThis project is no longer maintained.")?.level).toBe("strong");
    expect(detectAbandonmentNotice("Looking for maintainers!")?.level).toBe("soft");
    expect(detectAbandonmentNotice("A fine library")?.level).toBe("none");
    expect(detectAbandonmentNotice(null)).toBeNull();
  });

  it("age curve is monotonic and bounded", () => {
    expect(ageCurve(0)).toBe(0);
    expect(ageCurve(1825)).toBeCloseTo(1, 5);
    expect(ageCurve(100000)).toBe(1);
  });
});

describe("Revival Score", () => {
  const mit = assessLicense({ spdx: "MIT", name: "MIT License" });
  const none = assessLicense(null);

  it("rewards popular, permissively licensed projects", () => {
    const good = calculateRevivalScore({ stars: 15000, forks: 2000, downloadsLastMonth: null, license: mit, deep: null, sizeKb: 800 });
    const poor = calculateRevivalScore({ stars: 20, forks: 1, downloadsLastMonth: null, license: none, deep: null, sizeKb: 800_000 });
    expect(good.score).toBeGreaterThan(poor.score);
  });

  it("pulls quick-scan scores toward 50 and lists unavailable factors", () => {
    const quick = calculateRevivalScore({ stars: 50000, forks: 9000, downloadsLastMonth: null, license: mit, deep: null, sizeKb: 100 });
    expect(quick.confidence).toBeLessThan(60);
    expect(quick.score).toBeLessThan(90);
    expect(quick.factors.filter((f) => !f.available).length).toBeGreaterThan(5);
  });

  it("uses technology debt in deep mode", () => {
    const deep = (techDebtPoints: number) =>
      calculateRevivalScore({
        stars: 1000, forks: 100, downloadsLastMonth: null, license: mit, sizeKb: 500,
        deep: { issuesLast12m: 10, maintenanceRequests: 1, pullRequestsLast12m: 2, docs: { score: 0.7, notes: [] }, tests: { hasTests: true, hasCi: true }, codeBytes: 300_000, languageCount: 1, fileCount: 200, techDebtPoints, dependencyHealth: EMPTY_DEPENDENCY_HEALTH, contributors: 20, activeForks: 0 },
      });
    expect(deep(0).score).toBeGreaterThan(deep(12).score);
    expect(deep(0).confidence).toBeGreaterThanOrEqual(90);
  });
});

describe("licenses and hidden gems", () => {
  it("classifies licenses", () => {
    expect(assessLicense({ spdx: "Apache-2.0", name: "Apache" }).kind).toBe("permissive");
    expect(assessLicense({ spdx: "GPL-3.0", name: "GPL" }).kind).toBe("copyleft");
    expect(assessLicense({ spdx: "MPL-2.0", name: "MPL" }).kind).toBe("weak-copyleft");
    expect(assessLicense(null).forkFriendly).toBe(false);
  });

  it("prefers abandoned, starred, unforked and compact projects", () => {
    const gem = calculateHiddenGemScore({ daysSinceActivity: 1000, stars: 1200, activeForkCount: 0, sizeBytes: 300_000, revivalScore: 75 });
    const taken = calculateHiddenGemScore({ daysSinceActivity: 1000, stars: 1200, activeForkCount: 4, sizeBytes: 300_000, revivalScore: 75 });
    const fresh = calculateHiddenGemScore({ daysSinceActivity: 30, stars: 1200, activeForkCount: 0, sizeBytes: 300_000, revivalScore: 75 });
    expect(gem).toBeGreaterThan(taken);
    expect(gem).toBeGreaterThan(fresh);
  });
});
