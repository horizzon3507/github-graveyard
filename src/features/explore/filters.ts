import { z } from "zod";
import { CATEGORY_KEYS } from "@/analysis/categories";
import { STATUS_ORDER } from "@/analysis/status";

export const SORT_OPTIONS = [
  { value: "most-abandoned", label: "Most Abandoned" },
  { value: "highest-revival", label: "Highest Revival Potential" },
  { value: "most-starred", label: "Most Starred" },
  { value: "recently-abandoned", label: "Recently Abandoned" },
  { value: "oldest", label: "Oldest" },
  { value: "community", label: "Most Active Community" },
  { value: "most-forked", label: "Most Forked" },
  { value: "hidden-gems", label: "Hidden Gems" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];
const SORT_KEYS = SORT_OPTIONS.map((s) => s.value) as [SortKey, ...SortKey[]];

const text = (max = 100) => z.string().trim().min(1).max(max).optional();
const int = (min = 0, max = 10_000_000) => z.coerce.number().int().min(min).max(max).optional();
const score = z.coerce.number().int().min(0).max(100).optional();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => !Number.isNaN(Date.parse(d)))
  .optional();

export const exploreFiltersSchema = z.object({
  q: text(200),
  language: text(50),
  license: text(50),
  category: z.enum(CATEGORY_KEYS).optional(),
  topic: text(50),
  owner: text(39),
  status: z.enum(STATUS_ORDER as [string, ...string[]]).optional(),
  minStars: int(),
  maxStars: int(),
  minForks: int(),
  maxForks: int(),
  minYears: z.coerce.number().min(0).max(40).optional(),
  maxYears: z.coerce.number().min(0).max(40).optional(),
  lastCommitBefore: date,
  lastCommitAfter: date,
  lastReleaseBefore: date,
  lastReleaseAfter: date,
  minSizeMb: z.coerce.number().min(0).max(100_000).optional(),
  maxSizeMb: z.coerce.number().min(0).max(100_000).optional(),
  minIssues: int(),
  maxIssues: int(),
  hasActiveForks: z.enum(["yes", "no"]).optional(),
  archived: z.enum(["only", "exclude"]).optional(),
  minGrave: score,
  maxGrave: score,
  minRevival: score,
  maxRevival: score,
  difficulty: z.enum(["EASY", "MODERATE", "HARD", "EXTREME"]).optional(),
  includeActive: z.enum(["1"]).optional(),
  live: z.enum(["0", "1"]).optional(),
  sort: z.enum(SORT_KEYS).default("most-starred"),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type ExploreFilters = z.infer<typeof exploreFiltersSchema>;

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

/** Parses untrusted query params. Invalid values are dropped rather than failing the whole request. */
export function parseExploreFilters(raw: RawParams): ExploreFilters {
  const entries: Record<string, string> = {};
  if (raw instanceof URLSearchParams) {
    raw.forEach((value, key) => {
      if (value !== "") entries[key] = value;
    });
  } else {
    for (const [key, value] of Object.entries(raw)) {
      const v = Array.isArray(value) ? value[0] : value;
      if (v !== undefined && v !== "") entries[key] = v;
    }
  }

  const result = exploreFiltersSchema.safeParse(entries);
  if (result.success) return result.data;

  const bad = new Set(result.error.issues.map((i) => String(i.path[0])));
  for (const key of bad) delete entries[key];
  return exploreFiltersSchema.parse(entries);
}

export function filtersToSearchParams(filters: Partial<ExploreFilters>, overrides: Partial<Record<keyof ExploreFilters, string | number | undefined | null>> = {}): URLSearchParams {
  const params = new URLSearchParams();
  const merged: Record<string, unknown> = { ...filters, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "sort" && value === "most-starred") continue;
    if (key === "page" && Number(value) === 1) continue;
    params.set(key, String(value));
  }
  return params;
}

export const FILTER_LABELS: Partial<Record<keyof ExploreFilters, string>> = {
  language: "Language",
  license: "License",
  category: "Category",
  topic: "Topic",
  owner: "Owner",
  status: "Status",
  minStars: "Min stars",
  maxStars: "Max stars",
  minForks: "Min forks",
  maxForks: "Max forks",
  minYears: "Min years abandoned",
  maxYears: "Max years abandoned",
  lastCommitBefore: "Last commit before",
  lastCommitAfter: "Last commit after",
  lastReleaseBefore: "Last release before",
  lastReleaseAfter: "Last release after",
  minSizeMb: "Min size (MB)",
  maxSizeMb: "Max size (MB)",
  minIssues: "Min open issues",
  maxIssues: "Max open issues",
  hasActiveForks: "Active forks",
  archived: "Archived",
  minGrave: "Min Grave Score",
  maxGrave: "Max Grave Score",
  minRevival: "Min Revival Score",
  maxRevival: "Max Revival Score",
  difficulty: "Difficulty",
};
