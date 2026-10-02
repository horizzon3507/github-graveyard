import type { MonthlyCount } from "@/types/github";

export interface ActivityPoint {
  month: string;
  commits: number;
}

export interface ActivityReport {
  series: ActivityPoint[];
  peak: { start: string; end: string; commits: number } | null;
  /** First month of the sustained drop in activity (null while the project is still busy). */
  declineStart: string | null;
  firstMonth: string | null;
  lastActiveMonth: string | null;
  monthsSilent: number;
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthIndex(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return y * 12 + (m - 1);
}

export function monthFromIndex(index: number): string {
  const y = Math.floor(index / 12);
  return `${y}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Fills gaps with zeros and extends the series up to `now`. */
export function fillMonths(monthly: MonthlyCount[], now: Date): ActivityPoint[] {
  if (monthly.length === 0) return [];
  const byMonth = new Map(monthly.map((m) => [m.month, m.count]));
  const start = Math.min(...monthly.map((m) => monthIndex(m.month)));
  const end = monthIndex(monthKey(now));
  const out: ActivityPoint[] = [];
  for (let i = start; i <= end; i++) {
    const month = monthFromIndex(i);
    out.push({ month, commits: byMonth.get(month) ?? 0 });
  }
  return out;
}

export function buildActivityReport(monthly: MonthlyCount[] | null, now: Date): ActivityReport | null {
  if (!monthly || monthly.length === 0) return null;
  const series = fillMonths(monthly, now);
  const counts = series.map((p) => p.commits);

  let bestSum = 0;
  let bestStart = 0;
  for (let i = 0; i < counts.length; i++) {
    const sum = counts.slice(i, i + 12).reduce((a, b) => a + b, 0);
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = i;
    }
  }
  const peak = bestSum > 0 ? { start: series[bestStart].month, end: series[Math.min(bestStart + 11, series.length - 1)].month, commits: bestSum } : null;

  let declineStart: string | null = null;
  if (peak) {
    const peakAvg = bestSum / 12;
    const trailing = (i: number) => {
      const from = Math.max(0, i - 5);
      const window = counts.slice(from, i + 1);
      return window.reduce((a, b) => a + b, 0) / window.length;
    };
    const peakEndIdx = Math.min(bestStart + 11, series.length - 1);
    let candidate: number | null = null;
    for (let i = series.length - 1; i > peakEndIdx; i--) {
      if (trailing(i) <= peakAvg * 0.35) candidate = i;
      else break;
    }
    if (candidate !== null) {
      let start = candidate;
      while (start > peakEndIdx && counts[start - 1] <= peakAvg * 0.35) start--;
      declineStart = series[start].month;
    }
  }

  const lastActiveIdx = counts.findLastIndex((c) => c > 0);
  return {
    series,
    peak,
    declineStart,
    firstMonth: series[0].month,
    lastActiveMonth: lastActiveIdx >= 0 ? series[lastActiveIdx].month : null,
    monthsSilent: lastActiveIdx >= 0 ? series.length - 1 - lastActiveIdx : series.length,
  };
}

export function bucketByMonth(dates: string[]): MonthlyCount[] {
  const map = new Map<string, number>();
  for (const d of dates) {
    const key = monthKey(new Date(d));
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
}

export interface TimelineEvent {
  key: string;
  date: string;
  title: string;
  detail?: string;
  tone: "birth" | "milestone" | "peak" | "decline" | "end";
}

export interface TimelineInput {
  createdAt: string;
  releases: { tag: string; publishedAt: string; prerelease: boolean }[];
  report: ActivityReport | null;
  lastCommitAt: string | null;
  lastReleaseAt: string | null;
  archived: boolean;
  pushedAt: string;
}

const firstOfMonth = (month: string) => `${month}-01T00:00:00.000Z`;

export function buildTimeline(input: TimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = [{ key: "created", date: input.createdAt, title: "Repository created", tone: "birth" }];
  const stable = input.releases.filter((r) => !r.prerelease).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const all = stable.length > 0 ? stable : [...input.releases].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  if (all.length > 0) {
    events.push({ key: "first-release", date: all[0].publishedAt, title: `First release ${all[0].tag}`, tone: "milestone" });
    const majors = all.slice(1, -1).filter((r) => /^v?\d+\.0(\.0)?$/.test(r.tag));
    for (const r of majors.slice(0, 4)) events.push({ key: `major-${r.tag}`, date: r.publishedAt, title: `Release ${r.tag}`, detail: "Major version", tone: "milestone" });
  }

  const { report } = input;
  if (report?.peak) {
    events.push({ key: "peak", date: firstOfMonth(report.peak.start), title: "Period of peak activity", detail: `${report.peak.commits} commits in 12 months`, tone: "peak" });
  }
  if (report?.declineStart) {
    events.push({ key: "decline", date: firstOfMonth(report.declineStart), title: "Activity falls off", detail: "Commit rate drops below a third of its peak", tone: "decline" });
  }
  if (all.length > 1) {
    const last = all[all.length - 1];
    events.push({ key: "last-release", date: last.publishedAt, title: `Last release ${last.tag}`, tone: "milestone" });
  }
  if (input.lastCommitAt) events.push({ key: "last-commit", date: input.lastCommitAt, title: "Last commit", tone: "end" });
  if (input.archived) events.push({ key: "archived", date: input.pushedAt, title: "Archived by the owner (approx. date of last push)", tone: "end" });

  const seen = new Set<string>();
  return events
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true)));
}
