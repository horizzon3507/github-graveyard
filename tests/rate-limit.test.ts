import { beforeEach, describe, expect, it } from "vitest";
import { check, resetRateLimits, enforceRateLimit } from "@/lib/rate-limit";
import { parseExploreFilters, filtersToSearchParams } from "@/features/explore/filters";
import { buildWhere } from "@/database/repository-queries";
import { buildGitHubQuery, buildIngestPlan } from "@/services/discovery";

beforeEach(() => resetRateLimits());

describe("rate limiter", () => {
  it("blocks after the limit and recovers after the window", () => {
    for (let i = 0; i < 3; i++) expect(check("k", 3, 1000, 0).allowed).toBe(true);
    expect(check("k", 3, 1000, 10)).toMatchObject({ allowed: false });
    expect(check("k", 3, 1000, 1500).allowed).toBe(true);
    expect(check("other", 3, 1000, 10).allowed).toBe(true);
  });

  it("throws a 429 app error through enforceRateLimit", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4" } });
    for (let i = 0; i < 2; i++) enforceRateLimit(req, "t", 2);
    expect(() => enforceRateLimit(req, "t", 2)).toThrowError(/Too many requests/);
  });
});

describe("explore filters", () => {
  it("parses valid params and drops invalid ones instead of failing", () => {
    const f = parseExploreFilters(new URLSearchParams("q=jquery&minStars=500&sort=hidden-gems&page=2&status=buried&minGrave=abc&difficulty=NOPE&lastCommitBefore=2020-01-01"));
    expect(f).toMatchObject({ q: "jquery", minStars: 500, sort: "hidden-gems", page: 2, status: "buried", lastCommitBefore: "2020-01-01" });
    expect(f.minGrave).toBeUndefined();
    expect(f.difficulty).toBeUndefined();
  });

  it("rejects injection-looking values and round-trips to a query string", () => {
    const f = parseExploreFilters({ language: "<script>", sort: "drop table", page: "-1", minStars: "1e99" });
    expect(f.sort).toBe("most-starred");
    expect(f.page).toBe(1);
    expect(f.minStars).toBeUndefined();
    expect(filtersToSearchParams(parseExploreFilters({ q: "a", sort: "oldest" })).toString()).toBe("q=a&sort=oldest");
  });

  it("builds a where clause excluding active repositories by default", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    expect(JSON.stringify(buildWhere({}, now))).toContain("lastActivityAt");
    expect(buildWhere({ includeActive: "1" }, now)).toEqual({});
    expect(JSON.stringify(buildWhere({ q: "owner/name" }, now))).toContain("owner");
  });
});

describe("discovery queries", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  it("builds GitHub queries that target abandoned, non-fork repositories", () => {
    const q = buildGitHubQuery({ q: "jquery plugin", language: "JavaScript" } as never, now)!;
    expect(q).toContain("jquery plugin in:name,description,topics");
    expect(q).toContain("fork:false");
    expect(q).toContain("pushed:<2026-04-04");
    expect(buildGitHubQuery({ q: "user:evil", } as never, now)).not.toContain("user:evil");
    expect(buildGitHubQuery({} as never, now)).toBeNull();
  });

  it("has an ingest plan covering legendary, archived and categories", () => {
    const labels = buildIngestPlan(now).map((p) => p.label);
    expect(labels).toEqual(expect.arrayContaining(["legendary", "archived", "hidden gems", "topic:game", "language:Rust"]));
  });
});
