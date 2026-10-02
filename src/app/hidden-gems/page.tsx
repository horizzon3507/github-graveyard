import type { Metadata } from "next";
import { Gem } from "lucide-react";
import { RepoCard } from "@/components/graveyard/repo-card";
import { StateMessage } from "@/components/graveyard/states";
import { Pagination } from "@/features/explore/pagination";
import { listHiddenGems } from "@/database/repository-queries";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Hidden Gems", description: "Abandoned projects with real traction, nobody continuing them and a small enough codebase to take over." };
export const dynamic = "force-dynamic";

export default async function HiddenGemsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Math.min(500, Number((await searchParams).page) || 1));
  let result;
  try {
    result = await listHiddenGems(page);
  } catch {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <StateMessage kind="unavailable" title="The graveyard is unreachable">Check that PostgreSQL is running and try again.</StateMessage>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 max-w-2xl space-y-3">
        <p className="flex items-center gap-2 text-sm text-grave-blue"><Gem className="size-4" /> Hidden Gems</p>
        <h1 className="text-3xl font-semibold tracking-tight">Good ideas nobody picked up</h1>
        <p className="text-muted-foreground">
          Projects that have been quiet for over a year, have real stars, a license, a small codebase and few or no active forks. Ranked by a Hidden Gem score (30% revival potential, 20% how abandoned, 20% popularity sweet spot, 15% no active fork yet, 15% compact code).
        </p>
      </header>
      <p className="mb-5 text-sm text-muted-foreground" aria-live="polite"><span className="font-mono text-foreground">{formatNumber(result.total)}</span> gems found</p>
      {result.items.length === 0 ? (
        <StateMessage kind="empty" title="No gems yet" action={{ href: "/explore", label: "Explore the graveyard" }}>
          Gems need full analyses to rank. Run <code className="font-mono text-xs">pnpm ingest</code> then <code className="font-mono text-xs">pnpm jobs:refresh</code>, or open a few repositories to analyze them.
        </StateMessage>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((repo) => (
            <li key={repo.id}><RepoCard repo={repo} /></li>
          ))}
        </ul>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} filters={{}} basePath="/hidden-gems" />
    </div>
  );
}
