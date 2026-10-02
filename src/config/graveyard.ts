import { DEFAULT_THRESHOLDS, type StatusThresholds } from "@/analysis/status";

/**
 * Status bands are configurable through GRAVEYARD_STATUS_THRESHOLDS, e.g.
 * "recently_abandoned=180,fading=365,buried=730,ancient=1825" (values in days
 * since the last commit).
 */
export function parseThresholds(raw: string | undefined): StatusThresholds {
  if (!raw) return DEFAULT_THRESHOLDS;
  const map: Record<string, number> = {};
  for (const part of raw.split(",")) {
    const [key, value] = part.split("=").map((s) => s.trim());
    const n = Number(value);
    if (key && Number.isFinite(n) && n > 0) map[key] = n;
  }
  const merged: StatusThresholds = {
    recentlyAbandonedDays: map.recently_abandoned ?? DEFAULT_THRESHOLDS.recentlyAbandonedDays,
    fadingDays: map.fading ?? DEFAULT_THRESHOLDS.fadingDays,
    buriedDays: map.buried ?? DEFAULT_THRESHOLDS.buriedDays,
    ancientDays: map.ancient ?? DEFAULT_THRESHOLDS.ancientDays,
  };
  const ordered =
    merged.recentlyAbandonedDays < merged.fadingDays && merged.fadingDays < merged.buriedDays && merged.buriedDays < merged.ancientDays;
  return ordered ? merged : DEFAULT_THRESHOLDS;
}

export const thresholds: StatusThresholds = parseThresholds(process.env.GRAVEYARD_STATUS_THRESHOLDS);

export const LEGENDARY_MIN_STARS = Number(process.env.LEGENDARY_MIN_STARS) > 0 ? Number(process.env.LEGENDARY_MIN_STARS) : 5000;

export const PAGE_SIZE = 24;
