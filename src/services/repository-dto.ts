import type { RepositoryDetail } from "@/database/repository-detail";
import { thresholds } from "@/config/graveyard";
import { getGraveStatus } from "@/analysis/status";

/** JSON-safe view of a repository for the public API (no internal ids beyond the slug). */
export function toRepositoryDto(detail: RepositoryDetail, now = new Date()) {
  const analysis = detail.analysis;
  return {
    owner: detail.owner,
    name: detail.name,
    fullName: `${detail.owner}/${detail.name}`,
    description: detail.description,
    url: detail.htmlUrl,
    homepage: detail.homepage,
    language: detail.language,
    topics: detail.topics,
    categories: detail.categories,
    license: detail.license ? { spdx: detail.license, name: detail.licenseName } : null,
    stars: detail.stars,
    forks: detail.forks,
    watchers: detail.watchers,
    openIssues: detail.openIssues,
    sizeKb: detail.sizeKb,
    archived: detail.archived,
    createdAt: detail.ghCreatedAt,
    lastCommitAt: detail.lastCommitAt ?? detail.pushedAt,
    lastReleaseAt: detail.lastReleaseAt,
    contributors: detail.contributors,
    status: getGraveStatus(detail.lastActivityAt, now, thresholds, detail.archived),
    resurrected: detail.resurrectionsAsOriginal.length > 0,
    scores: {
      grave: detail.graveScore,
      revival: detail.revivalScore,
      hiddenGem: detail.hiddenGemScore,
      community: detail.communityScore,
    },
    analysis: analysis
      ? {
          status: analysis.status,
          depth: analysis.depth,
          lastAnalyzedAt: analysis.lastAnalyzedAt,
          error: analysis.error,
          difficulty: analysis.difficulty,
          effort: analysis.effort,
        }
      : null,
    revivalInterestCount: detail._count.interests,
  };
}
