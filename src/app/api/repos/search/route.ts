import { json, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseExploreFilters } from "@/features/explore/filters";
import { searchRepositories } from "@/database/repository-queries";
import { discoverFromGitHub } from "@/services/discovery";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  enforceRateLimit(request, "search", 60);
  const filters = parseExploreFilters(new URL(request.url).searchParams);
  let page = await searchRepositories(filters);
  let live = { status: "skipped" as string, imported: 0 };
  const wantsLive = filters.live !== "0" && filters.page === 1 && (filters.q || filters.language || filters.topic || filters.owner);
  if (wantsLive && page.total < page.pageSize) {
    live = await discoverFromGitHub(filters);
    if (live.imported > 0) page = await searchRepositories(filters);
  }
  return json({
    items: page.items.map((r) => ({ owner: r.owner, name: r.name, fullName: `${r.owner}/${r.name}`, description: r.description, language: r.language, stars: r.stars, forks: r.forks, openIssues: r.openIssues, license: r.license, archived: r.archived, lastActivityAt: r.lastActivityAt, lastReleaseAt: r.lastReleaseAt, graveScore: r.graveScore, revivalScore: r.revivalScore, difficulty: r.difficulty, resurrected: r.resurrected, analysisDepth: r.analysisDepth })),
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    pageCount: page.pageCount,
    live: live.status,
  });
});
