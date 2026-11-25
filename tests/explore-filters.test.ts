import { describe, expect, it } from "vitest";
import { exploreFiltersSchema, filtersToSearchParams, parseExploreFilters } from "@/features/explore/filters";

describe("parseExploreFilters", () => {
  it("applies defaults for sort and page", () => {
    const filters = parseExploreFilters({});
    expect(filters.sort).toBe("most-starred");
    expect(filters.page).toBe(1);
  });

  it("parses a full query string", () => {
    const filters = parseExploreFilters(
      new URLSearchParams("q=redis&language=TypeScript&minStars=50&maxRevival=80&status=buried&sort=hidden-gems&page=3"),
    );
    expect(filters).toMatchObject({ q: "redis", language: "TypeScript", minStars: 50, maxRevival: 80, status: "buried", sort: "hidden-gems", page: 3 });
  });

  it("drops invalid values but keeps the valid ones", () => {
    const filters = parseExploreFilters({ page: "abc", minStars: "10", sort: "nonsense" });
    expect(filters.page).toBe(1);
    expect(filters.sort).toBe("most-starred");
    expect(filters.minStars).toBe(10);
  });

  it("rejects out-of-range scores and malformed dates", () => {
    const filters = parseExploreFilters({ minGrave: "150", lastCommitBefore: "2024-13-40" });
    expect(filters.minGrave).toBeUndefined();
    expect(filters.lastCommitBefore).toBeUndefined();
  });

  it("takes the first value of repeated params and ignores empties", () => {
    const filters = parseExploreFilters({ language: ["Go", "Rust"], q: "" });
    expect(filters.language).toBe("Go");
    expect(filters.q).toBeUndefined();
  });

  it("caps over-long search text", () => {
    const filters = parseExploreFilters({ q: "x".repeat(500) });
    expect(filters.q).toBeUndefined();
  });
});

describe("filtersToSearchParams", () => {
  it("omits defaults and empty values", () => {
    const params = filtersToSearchParams({ sort: "most-starred", page: 1, q: "redis", language: undefined });
    expect(params.get("sort")).toBeNull();
    expect(params.get("page")).toBeNull();
    expect(params.get("q")).toBe("redis");
  });

  it("round-trips through parseExploreFilters", () => {
    const original = parseExploreFilters({ q: "redis", minStars: "50", sort: "most-abandoned", page: "2" });
    const params = filtersToSearchParams(original);
    expect(parseExploreFilters(params)).toMatchObject({ q: "redis", minStars: 50, sort: "most-abandoned", page: 2 });
  });
});

describe("exploreFiltersSchema", () => {
  it("rejects unknown enum values", () => {
    expect(exploreFiltersSchema.safeParse({ difficulty: "IMPOSSIBLE" }).success).toBe(false);
    expect(exploreFiltersSchema.safeParse({ difficulty: "HARD" }).success).toBe(true);
  });
});
