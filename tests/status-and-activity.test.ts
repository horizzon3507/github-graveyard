import { describe, expect, it } from "vitest";
import { getGraveStatus, statusDateRange, DEFAULT_THRESHOLDS } from "@/analysis/status";
import { parseThresholds } from "@/config/graveyard";
import { buildActivityReport, buildTimeline, fillMonths } from "@/analysis/activity";

const now = new Date("2026-10-01T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe("status bands", () => {
  it("maps age to the documented bands", () => {
    const at = (d: number, archived = false) => getGraveStatus(daysAgo(d), now, DEFAULT_THRESHOLDS, archived);
    expect(at(30)).toBe("active");
    expect(at(30, true)).toBe("recently_abandoned");
    expect(at(200)).toBe("recently_abandoned");
    expect(at(500)).toBe("fading");
    expect(at(1000)).toBe("buried");
    expect(at(2000)).toBe("ancient");
  });

  it("is configurable and validates ordering", () => {
    expect(parseThresholds("recently_abandoned=90,fading=200,buried=400,ancient=900").buriedDays).toBe(400);
    expect(parseThresholds("fading=9999")).toEqual(DEFAULT_THRESHOLDS);
    expect(parseThresholds(undefined)).toEqual(DEFAULT_THRESHOLDS);
  });

  it("produces date windows that agree with getGraveStatus", () => {
    const range = statusDateRange("buried", now);
    const inside = daysAgo(1000);
    expect(inside >= range.gte! && inside < range.lt!).toBe(true);
  });
});

describe("activity report", () => {
  const monthly = [
    ...Array.from({ length: 12 }, (_, i) => ({ month: `2019-${String(i + 1).padStart(2, "0")}`, count: 50 })),
    ...Array.from({ length: 6 }, (_, i) => ({ month: `2020-${String(i + 1).padStart(2, "0")}`, count: 20 })),
    { month: "2020-09", count: 1 },
  ];

  it("finds the peak and the start of the decline", () => {
    const report = buildActivityReport(monthly, now)!;
    expect(report.peak?.start).toBe("2019-01");
    expect(report.declineStart).not.toBeNull();
    expect(report.declineStart! > "2019-12").toBe(true);
    expect(report.lastActiveMonth).toBe("2020-09");
    expect(report.monthsSilent).toBeGreaterThan(60);
  });

  it("reports no decline while the project is busy", () => {
    const busy = Array.from({ length: 24 }, (_, i) => ({ month: `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`, count: 30 }));
    expect(buildActivityReport(busy, new Date("2025-12-15T00:00:00Z"))!.declineStart).toBeNull();
  });

  it("fills gaps and handles empty input", () => {
    expect(fillMonths([{ month: "2020-01", count: 1 }, { month: "2020-04", count: 2 }], new Date("2020-04-10T00:00:00Z")).map((p) => p.commits)).toEqual([1, 0, 0, 2]);
    expect(buildActivityReport(null, now)).toBeNull();
    expect(buildActivityReport([], now)).toBeNull();
  });

  it("builds an ordered timeline", () => {
    const report = buildActivityReport(monthly, now);
    const events = buildTimeline({
      createdAt: "2018-05-01T00:00:00Z",
      releases: [{ tag: "v1.0.0", publishedAt: "2018-08-01T00:00:00Z", prerelease: false }, { tag: "v2.0.0", publishedAt: "2019-06-01T00:00:00Z", prerelease: false }, { tag: "v2.1.0", publishedAt: "2020-02-01T00:00:00Z", prerelease: false }],
      report,
      lastCommitAt: "2020-09-15T00:00:00Z",
      lastReleaseAt: "2020-02-01T00:00:00Z",
      archived: false,
      pushedAt: "2020-09-15T00:00:00Z",
    });
    expect(events[0].key).toBe("created");
    expect(events.at(-1)?.key).toBe("last-commit");
    expect(events.map((e) => e.date)).toEqual([...events.map((e) => e.date)].sort());
    expect(events.some((e) => e.key === "last-release")).toBe(true);
  });
});
