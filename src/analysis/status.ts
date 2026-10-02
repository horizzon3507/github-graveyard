import type { GraveStatusKey } from "@/types/analysis";

export interface StatusThresholds {
  recentlyAbandonedDays: number;
  fadingDays: number;
  buriedDays: number;
  ancientDays: number;
}

export const DEFAULT_THRESHOLDS: StatusThresholds = {
  recentlyAbandonedDays: 180,
  fadingDays: 365,
  buriedDays: 730,
  ancientDays: 1825,
};

export const STATUS_ORDER: GraveStatusKey[] = ["active", "recently_abandoned", "fading", "buried", "ancient"];

export const STATUS_META: Record<GraveStatusKey, { label: string; description: (t: StatusThresholds) => string }> = {
  active: { label: "Active", description: (t) => `Last activity within ${Math.round(t.recentlyAbandonedDays / 30)} months.` },
  recently_abandoned: {
    label: "Recently Abandoned",
    description: (t) => `Last activity ${Math.round(t.recentlyAbandonedDays / 30)}–${Math.round(t.fadingDays / 30)} months ago.`,
  },
  fading: { label: "Fading", description: (t) => `${t.fadingDays / 365}–${t.buriedDays / 365} years without maintenance.` },
  buried: { label: "Buried", description: (t) => `${t.buriedDays / 365}–${t.ancientDays / 365} years without maintenance.` },
  ancient: { label: "Ancient", description: (t) => `More than ${t.ancientDays / 365} years without maintenance.` },
};

export function getGraveStatus(
  lastActivity: Date,
  now: Date,
  thresholds: StatusThresholds = DEFAULT_THRESHOLDS,
  archived = false,
): GraveStatusKey {
  const days = (now.getTime() - lastActivity.getTime()) / 86_400_000;
  if (days >= thresholds.ancientDays) return "ancient";
  if (days >= thresholds.buriedDays) return "buried";
  if (days >= thresholds.fadingDays) return "fading";
  if (days >= thresholds.recentlyAbandonedDays || archived) return "recently_abandoned";
  return "active";
}

export interface DateRange {
  /** inclusive lower bound */
  gte?: Date;
  /** exclusive upper bound */
  lt?: Date;
}

/** Converts a status into a lastActivityAt window so filtering can happen in SQL. */
export function statusDateRange(status: GraveStatusKey, now: Date, t: StatusThresholds = DEFAULT_THRESHOLDS): DateRange {
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
  switch (status) {
    case "active":
      return { gte: ago(t.recentlyAbandonedDays) };
    case "recently_abandoned":
      return { gte: ago(t.fadingDays), lt: ago(t.recentlyAbandonedDays) };
    case "fading":
      return { gte: ago(t.buriedDays), lt: ago(t.fadingDays) };
    case "buried":
      return { gte: ago(t.ancientDays), lt: ago(t.buriedDays) };
    case "ancient":
      return { lt: ago(t.ancientDays) };
  }
}

export function isGraveStatus(value: string): value is GraveStatusKey {
  return (STATUS_ORDER as string[]).includes(value);
}
