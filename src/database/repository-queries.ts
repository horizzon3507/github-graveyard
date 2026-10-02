import { Prisma, type Repository } from "@/generated/prisma/client";
import { db } from "@/database/client";
import { thresholds, LEGENDARY_MIN_STARS, PAGE_SIZE } from "@/config/graveyard";
import { statusDateRange } from "@/analysis/status";
import type { ExploreFilters, SortKey } from "@/features/explore/filters";

const DAY = 86_400_000;

export interface ListOptions {
  now?: Date;
  pageSize?: number;
}

function abandonedClause(now: Date): Prisma.RepositoryWhereInput {
  return { OR: [{ lastActivityAt: { lt: new Date(now.getTime() - thresholds.recentlyAbandonedDays * DAY) } }, { archived: true }] };
}

export function buildWhere(filters: Partial<ExploreFilters>, now: Date): Prisma.RepositoryWhereInput {
  const and: Prisma.RepositoryWhereInput[] = [];

  if (filters.status) {
    const range = statusDateRange(filters.status as never, now, thresholds);
    const byDate: Prisma.RepositoryWhereInput = { lastActivityAt: { ...(range.gte && { gte: range.gte }), ...(range.lt && { lt: range.lt }) } };
    if (filters.status === "active") and.push({ AND: [byDate, { archived: false }] });
    else if (filters.status === "recently_abandoned") and.push({ OR: [byDate, { AND: [{ archived: true }, { lastActivityAt: { gte: range.lt } }] }] });
    else and.push(byDate);
  } else if (!filters.includeActive) {
    and.push(abandonedClause(now));
  }

  if (filters.q) {
    const q = filters.q.trim();
    const slashed = q.match(/^([\w.-]+)\/([\w.-]*)$/);
    if (slashed) {
      and.push({ owner: { contains: slashed[1], mode: "insensitive" } }, { name: { contains: slashed[2], mode: "insensitive" } });
    } else {
      for (const token of q.split(/\s+/).slice(0, 6)) {
        and.push({
          OR: [
            { name: { contains: token, mode: "insensitive" } },
            { owner: { contains: token, mode: "insensitive" } },
            { description: { contains: token, mode: "insensitive" } },
            { topics: { has: token.toLowerCase() } },
            { language: { equals: token, mode: "insensitive" } },
          ],
        });
      }
    }
  }

  if (filters.language) and.push({ language: { equals: filters.language, mode: "insensitive" } });
  if (filters.license) and.push(filters.license === "none" ? { license: null } : { license: { equals: filters.license, mode: "insensitive" } });
  if (filters.category) and.push({ categories: { has: filters.category } });
  if (filters.topic) and.push({ topics: { has: filters.topic.toLowerCase() } });
  if (filters.owner) and.push({ owner: { equals: filters.owner, mode: "insensitive" } });

  const range = (min?: number, max?: number) => (min !== undefined || max !== undefined ? { ...(min !== undefined && { gte: min }), ...(max !== undefined && { lte: max }) } : undefined);
  const numeric: [keyof Prisma.RepositoryWhereInput, number | undefined, number | undefined][] = [
    ["stars", filters.minStars, filters.maxStars],
    ["forks", filters.minForks, filters.maxForks],
    ["openIssues", filters.minIssues, filters.maxIssues],
    ["graveScore", filters.minGrave, filters.maxGrave],
    ["revivalScore", filters.minRevival, filters.maxRevival],
  ];
  for (const [field, min, max] of numeric) {
    const r = range(min, max);
    if (r) and.push({ [field]: r } as Prisma.RepositoryWhereInput);
  }

  if (filters.minSizeMb !== undefined || filters.maxSizeMb !== undefined) {
    and.push({ sizeKb: range(filters.minSizeMb !== undefined ? Math.round(filters.minSizeMb * 1024) : undefined, filters.maxSizeMb !== undefined ? Math.round(filters.maxSizeMb * 1024) : undefined) });
  }

  if (filters.minYears !== undefined) and.push({ lastActivityAt: { lte: new Date(now.getTime() - filters.minYears * 365.25 * DAY) } });
  if (filters.maxYears !== undefined) and.push({ lastActivityAt: { gte: new Date(now.getTime() - filters.maxYears * 365.25 * DAY) } });
  if (filters.lastCommitBefore) and.push({ lastActivityAt: { lt: new Date(`${filters.lastCommitBefore}T00:00:00Z`) } });
  if (filters.lastCommitAfter) and.push({ lastActivityAt: { gte: new Date(`${filters.lastCommitAfter}T00:00:00Z`) } });
  if (filters.lastReleaseBefore) and.push({ lastReleaseAt: { lt: new Date(`${filters.lastReleaseBefore}T00:00:00Z`) } });
  if (filters.lastReleaseAfter) and.push({ lastReleaseAt: { gte: new Date(`${filters.lastReleaseAfter}T00:00:00Z`) } });

  if (filters.hasActiveForks === "yes") and.push({ activeForkCount: { gt: 0 } });
  if (filters.hasActiveForks === "no") and.push({ OR: [{ activeForkCount: 0 }, { activeForkCount: null }] });
  if (filters.archived === "only") and.push({ archived: true });
  if (filters.archived === "exclude") and.push({ archived: false });
  if (filters.difficulty) and.push({ difficulty: filters.difficulty });

  return and.length ? { AND: and } : {};
}

const ORDER: Record<SortKey, Prisma.RepositoryOrderByWithRelationInput[]> = {
  "most-abandoned": [{ graveScore: { sort: "desc", nulls: "last" } }, { lastActivityAt: "asc" }],
  "highest-revival": [{ revivalScore: { sort: "desc", nulls: "last" } }, { stars: "desc" }],
  "most-starred": [{ stars: "desc" }, { id: "asc" }],
  "recently-abandoned": [{ lastActivityAt: "desc" }, { stars: "desc" }],
  oldest: [{ lastActivityAt: "asc" }, { stars: "desc" }],
  community: [{ communityScore: { sort: "desc", nulls: "last" } }, { stars: "desc" }],
  "most-forked": [{ forks: "desc" }, { id: "asc" }],
  "hidden-gems": [{ hiddenGemScore: { sort: "desc", nulls: "last" } }, { stars: "desc" }],
};

const cardInclude = { resurrectionsAsOriginal: { select: { id: true }, take: 1 } } satisfies Prisma.RepositoryInclude;

export type RepositoryCard = Omit<Repository, "githubId"> & { resurrected: boolean };

export function toCard(repo: Repository & { resurrectionsAsOriginal?: { id: string }[] }): RepositoryCard {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { githubId, resurrectionsAsOriginal, ...rest } = repo;
  return { ...rest, resurrected: (resurrectionsAsOriginal?.length ?? 0) > 0 };
}

export interface SearchPage {
  items: RepositoryCard[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function searchRepositories(filters: Partial<ExploreFilters>, options: ListOptions = {}): Promise<SearchPage> {
  const now = options.now ?? new Date();
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const page = filters.page ?? 1;
  const where = buildWhere(filters, now);
  const [total, rows] = await Promise.all([
    db.repository.count({ where }),
    db.repository.findMany({
      where,
      orderBy: ORDER[filters.sort ?? "most-starred"],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: cardInclude,
    }),
  ]);
  return { items: rows.map(toCard), total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listFeatured(limit = 6, now = new Date()): Promise<RepositoryCard[]> {
  const rows = await db.repository.findMany({
    where: { AND: [abandonedClause(now), { revivalScore: { gte: 55 } }, { analysisDepth: "DEEP" }] },
    orderBy: [{ revivalScore: "desc" }, { stars: "desc" }],
    take: limit,
    include: cardInclude,
  });
  if (rows.length >= limit) return rows.map(toCard);
  const fallback = await db.repository.findMany({
    where: { AND: [abandonedClause(now), { id: { notIn: rows.map((r) => r.id) } }] },
    orderBy: [{ revivalScore: { sort: "desc", nulls: "last" } }, { stars: "desc" }],
    take: limit - rows.length,
    include: cardInclude,
  });
  return [...rows, ...fallback].map(toCard);
}

export async function listHiddenGems(page = 1, pageSize = PAGE_SIZE, now = new Date()): Promise<SearchPage> {
  const where: Prisma.RepositoryWhereInput = {
    AND: [
      { lastActivityAt: { lt: new Date(now.getTime() - thresholds.fadingDays * DAY) } },
      { stars: { gte: 50 } },
      { OR: [{ activeForkCount: null }, { activeForkCount: { lte: 2 } }] },
      { license: { not: null } },
      { hiddenGemScore: { gte: 50 } },
      { resurrectionsAsOriginal: { none: {} } },
    ],
  };
  const [total, rows] = await Promise.all([
    db.repository.count({ where }),
    db.repository.findMany({ where, orderBy: [{ hiddenGemScore: "desc" }, { stars: "desc" }], skip: (page - 1) * pageSize, take: pageSize, include: cardInclude }),
  ]);
  return { items: rows.map(toCard), total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listLegendary(page = 1, pageSize = PAGE_SIZE, now = new Date()): Promise<SearchPage> {
  const where: Prisma.RepositoryWhereInput = {
    AND: [{ stars: { gte: LEGENDARY_MIN_STARS } }, { lastActivityAt: { lt: new Date(now.getTime() - thresholds.fadingDays * DAY) } }],
  };
  const [total, rows] = await Promise.all([
    db.repository.count({ where }),
    db.repository.findMany({ where, orderBy: [{ stars: "desc" }], skip: (page - 1) * pageSize, take: pageSize, include: cardInclude }),
  ]);
  return { items: rows.map(toCard), total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function randomGrave(now = new Date()): Promise<{ owner: string; name: string } | null> {
  const where = { AND: [abandonedClause(now), { stars: { gte: 25 } }] } satisfies Prisma.RepositoryWhereInput;
  const total = await db.repository.count({ where });
  if (total === 0) return null;
  const [row] = await db.repository.findMany({ where, skip: Math.floor(Math.random() * total), take: 1, select: { owner: true, name: true } });
  return row ?? null;
}

export async function graveyardStats(now = new Date()) {
  const [total, deep] = await Promise.all([db.repository.count({ where: abandonedClause(now) }), db.repository.count({ where: { analysisDepth: "DEEP" } })]);
  return { total, deep };
}

export async function facetOptions() {
  const [languages, licenses] = await Promise.all([
    db.repository.groupBy({ by: ["language"], _count: { _all: true }, where: { language: { not: null } }, orderBy: { _count: { language: "desc" } }, take: 40 }),
    db.repository.groupBy({ by: ["license"], _count: { _all: true }, where: { license: { not: null } }, orderBy: { _count: { license: "desc" } }, take: 20 }),
  ]);
  return {
    languages: languages.map((l) => l.language as string).sort((a, b) => a.localeCompare(b)),
    licenses: licenses.map((l) => l.license as string),
  };
}
