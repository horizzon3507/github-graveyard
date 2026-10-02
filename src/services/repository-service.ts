import "server-only";
import { Prisma, type AnalysisDepth, type Repository, type RepositorySource } from "@/generated/prisma/client";
import { db } from "@/database/client";
import type { RepoMetadata } from "@/types/github";
import type { AnalysisResult } from "@/types/analysis";
import { categorize } from "@/analysis/categories";
import { analyzeRepository, ALGORITHM_VERSION } from "@/analysis/analyze";
import { toSlug } from "@/lib/validation";
import { getGitHub } from "@/services/github";
import { hasCode } from "@/lib/errors";

export const j = (value: unknown) => value as Prisma.InputJsonValue;

export function analysisColumns(result: AnalysisResult, now: Date, extras: { summarySource?: string | null } = {}) {
  return {
    algorithmVersion: ALGORITHM_VERSION,
    depth: result.depth as AnalysisDepth,
    graveScore: result.grave.score,
    graveConfidence: result.grave.confidence,
    revivalScore: result.revival.score,
    revivalConfidence: result.revival.confidence,
    hiddenGemScore: result.hiddenGemScore,
    communityScore: result.communityScore,
    difficulty: result.difficulty,
    effort: result.effort,
    graveFactors: j(result.grave.factors),
    revivalFactors: j(result.revival.factors),
    abandonmentSignals: j(result.abandonmentSignals),
    communitySignals: j(result.communitySignals),
    technologies: j(result.technologies),
    challenges: j(result.challenges),
    modernizationSuggestions: j(result.modernizationSuggestions),
    roadmap: j(result.roadmap),
    issuesWorthSolving: j(result.issuesWorthSolving),
    licenseAssessment: j(result.licenseAssessment),
    buildSignal: j(result.buildSignal),
    dependencyHealth: j(result.dependencyHealth),
    summary: result.summary,
    summarySource: extras.summarySource ?? (result.summary ? "readme" : null),
    notes: j(result.notes),
    error: null,
    lastAnalyzedAt: now,
  };
}

function metadataColumns(meta: RepoMetadata, now: Date) {
  return {
    owner: meta.owner,
    name: meta.name,
    slug: toSlug(meta.owner, meta.name),
    description: meta.description,
    htmlUrl: meta.htmlUrl,
    homepage: meta.homepage,
    language: meta.language,
    topics: meta.topics.map((t) => t.toLowerCase()),
    categories: categorize({ name: meta.name, description: meta.description, topics: meta.topics, language: meta.language }),
    license: meta.license?.spdx ?? (meta.license ? "OTHER" : null),
    licenseName: meta.license?.name ?? null,
    stars: meta.stars,
    forks: meta.forks,
    watchers: meta.watchers,
    openIssues: meta.openIssues,
    sizeKb: meta.sizeKb,
    archived: meta.archived,
    isFork: meta.isFork,
    parentSlug: meta.parent ? meta.parent.toLowerCase() : null,
    defaultBranch: meta.defaultBranch,
    ownerType: meta.ownerType,
    ghCreatedAt: new Date(meta.createdAt),
    pushedAt: new Date(meta.pushedAt),
    syncedAt: now,
  };
}

/**
 * Stores repository metadata. New repositories get a quick-scan analysis computed from
 * metadata alone; repositories that already have a deep analysis keep it.
 */
export async function upsertRepository(meta: RepoMetadata, source: RepositorySource, now = new Date()): Promise<Repository> {
  const githubId = BigInt(meta.githubId);
  const columns = metadataColumns(meta, now);
  const existing = await db.repository.findUnique({ where: { githubId }, select: { id: true, analysisDepth: true } });

  if (existing) {
    const updated = await db.repository.update({
      where: { id: existing.id },
      data: existing.analysisDepth === "QUICK" ? { ...columns, lastActivityAt: columns.pushedAt } : columns,
    });
    if (existing.analysisDepth === "QUICK") await writeQuickAnalysis(updated, meta, now);
    return updated;
  }

  await db.repository.deleteMany({ where: { slug: columns.slug, NOT: { githubId } } });
  const created = await db.repository.create({ data: { githubId, source, ...columns, lastActivityAt: columns.pushedAt } });
  await writeQuickAnalysis(created, meta, now);
  return created;
}

export async function writeQuickAnalysis(repository: Repository, meta: RepoMetadata, now: Date) {
  const result = analyzeRepository({
    now,
    repo: meta,
    lastCommitAt: null,
    lastReleaseAt: null,
    data: null,
    files: {},
    paths: [],
    readme: null,
    forks: [],
    dependencyHealth: { ecosystem: null, checked: 0, total: 0, outdated: [], deprecated: [], healthyRatio: null },
    summary: meta.description,
  });
  const columns = analysisColumns(result, now, { summarySource: meta.description ? "description" : null });
  await db.repositoryAnalysis.upsert({
    where: { repositoryId: repository.id },
    create: { repositoryId: repository.id, status: "COMPLETE", ...columns },
    update: { status: "COMPLETE", ...columns },
  });
  await db.repository.update({
    where: { id: repository.id },
    data: {
      graveScore: result.grave.score,
      revivalScore: result.revival.score,
      hiddenGemScore: result.hiddenGemScore,
      communityScore: result.communityScore,
      difficulty: null,
      analysisDepth: "QUICK",
    },
  });
}

const METADATA_TTL_MS = 6 * 3600_000;

/** Finds a repository in the database or pulls it from GitHub (quick scan) when it is new or stale. */
export async function ensureRepository(owner: string, name: string, source: RepositorySource = "ANALYZE"): Promise<Repository> {
  const slug = toSlug(owner, name);
  const existing = await db.repository.findUnique({ where: { slug } });
  if (existing && Date.now() - existing.syncedAt.getTime() < METADATA_TTL_MS) return existing;
  try {
    const meta = await getGitHub().github.getRepository(owner, name);
    return await upsertRepository(meta, source);
  } catch (error) {
    if (existing && !hasCode(error, "not_found")) return existing;
    if (existing && hasCode(error, "not_found")) await db.repository.delete({ where: { id: existing.id } }).catch(() => undefined);
    throw error;
  }
}

/** Rebuilds quick scans whose algorithm version is behind, using stored metadata only (no GitHub calls). */
export async function recomputeQuickAnalyses(now = new Date()): Promise<number> {
  let done = 0;
  for (;;) {
    const rows = await db.repository.findMany({
      where: { analysisDepth: "QUICK", analysis: { is: { algorithmVersion: { lt: ALGORITHM_VERSION } } } },
      take: 200,
    });
    if (rows.length === 0) return done;
    for (const r of rows) {
      const meta: RepoMetadata = {
        githubId: Number(r.githubId),
        owner: r.owner,
        name: r.name,
        description: r.description,
        htmlUrl: r.htmlUrl,
        homepage: r.homepage,
        language: r.language,
        topics: r.topics,
        license: r.licenseName ? { spdx: r.license === "OTHER" ? null : r.license, name: r.licenseName } : null,
        stars: r.stars,
        forks: r.forks,
        watchers: r.watchers,
        openIssues: r.openIssues,
        sizeKb: r.sizeKb,
        archived: r.archived,
        disabled: false,
        isPrivate: false,
        isFork: r.isFork,
        parent: r.parentSlug,
        root: null,
        defaultBranch: r.defaultBranch,
        ownerType: r.ownerType,
        createdAt: r.ghCreatedAt.toISOString(),
        pushedAt: r.pushedAt.toISOString(),
      };
      await writeQuickAnalysis(r, meta, now);
      done++;
    }
  }
}
