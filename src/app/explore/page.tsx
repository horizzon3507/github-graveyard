import type { Metadata } from "next";
import { RepoCard } from "@/components/graveyard/repo-card";
import { StateMessage, formatReset } from "@/components/graveyard/states";
import { ActiveFilters } from "@/features/explore/active-filters";
import { FilterPanel } from "@/features/explore/filter-panel";
import { Pagination } from "@/features/explore/pagination";
import { SortSelect } from "@/features/explore/sort-select";
import { SearchBox } from "@/features/home/search-box";
import { parseExploreFilters } from "@/features/explore/filters";
import { facetOptions, searchRepositories, type SearchPage } from "@/database/repository-queries";
import { discoverFromGitHub, type LiveSearchResult } from "@/services/discovery";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Explore the Graveyard", description: "Browse and filter abandoned open-source repositories by Grave Score, Revival Score, stars, language and more." };
export const dynamic = "force-dynamic";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseExploreFilters(await searchParams);

  let page: SearchPage;
  let facets = { languages: [] as string[], licenses: [] as string[] };
  let live: LiveSearchResult = { status: "skipped", imported: 0 };
  try {
    page = await searchRepositories(filters);
    const wantsLive = filters.live !== "0" && filters.page === 1 && Boolean(filters.q || filters.language || filters.topic || filters.owner);
    if (wantsLive && page.total < page.pageSize) {
      live = await discoverFromGitHub(filters);
      if (live.imported > 0) page = await searchRepositories(filters);
    }
    facets = await facetOptions();
  } catch (error) {
    console.error("[explore] failed", error);
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <StateMessage kind="unavailable" title="The graveyard is unreachable">
          We couldn&apos;t load repositories. Check that PostgreSQL is running and try again.
        </StateMessage>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Explore the Graveyard</h1>
        <p className="max-w-2xl text-muted-foreground">Abandoned repositories with stars, forks and open questions left behind. Filter by how long they have been quiet and how likely they are to be revived.</p>
        <SearchBox size="md" className="max-w-2xl pt-2" />
      </header>

      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <FilterPanel filters={filters} languages={facets.languages} licenses={facets.licenses} />

        <section aria-label="Results" className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <span className="font-mono text-foreground">{formatNumber(page.total)}</span> {page.total === 1 ? "grave" : "graves"}
            </p>
            <SortSelect value={filters.sort} />
          </div>
          <ActiveFilters filters={filters} />

          {live.status === "rate_limited" && (
            <p className="surface px-4 py-3 text-sm text-muted-foreground" role="status">
              GitHub&apos;s search rate limit was reached, so only graveyard results are shown. Live search resumes {formatReset(live.resetAt)}.
            </p>
          )}
          {live.status === "unavailable" && (
            <p className="surface px-4 py-3 text-sm text-muted-foreground" role="status">
              GitHub&apos;s API is unavailable right now, so only graveyard results are shown.
            </p>
          )}

          {page.items.length === 0 ? (
            <StateMessage kind="empty" title="Nothing buried here" action={{ href: "/explore", label: "Clear filters" }}>
              No repositories match these filters. Try loosening them, or run <code className="font-mono text-xs">pnpm ingest</code> to load more graves from GitHub.
            </StateMessage>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {page.items.map((repo) => (
                <li key={repo.id}>
                  <RepoCard repo={repo} />
                </li>
              ))}
            </ul>
          )}
          <Pagination page={page.page} pageCount={page.pageCount} filters={filters} basePath="/explore" />
        </section>
      </div>
    </div>
  );
}
