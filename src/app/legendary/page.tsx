import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { RepoCard } from "@/components/graveyard/repo-card";
import { StateMessage } from "@/components/graveyard/states";
import { Pagination } from "@/features/explore/pagination";
import { listLegendary } from "@/database/repository-queries";
import { LEGENDARY_MIN_STARS } from "@/config/graveyard";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Legendary Graves", description: "Projects that were enormously popular on GitHub before they lost their maintainers." };
export const dynamic = "force-dynamic";

export default async function LegendaryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Math.min(500, Number((await searchParams).page) || 1));
  let result;
  try {
    result = await listLegendary(page);
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
        <p className="flex items-center gap-2 text-sm text-grave-amber"><Landmark className="size-4" /> Legendary Graves</p>
        <h1 className="text-3xl font-semibold tracking-tight">Once everywhere, now quiet</h1>
        <p className="text-muted-foreground">
          Repositories with at least {formatNumber(LEGENDARY_MIN_STARS)} stars and no maintenance for over a year. Every number comes straight from GitHub: nothing here is curated by hand or invented.
        </p>
      </header>
      <p className="mb-5 text-sm text-muted-foreground" aria-live="polite"><span className="font-mono text-foreground">{formatNumber(result.total)}</span> legends</p>
      {result.items.length === 0 ? (
        <StateMessage kind="empty" title="No legends catalogued yet" action={{ href: "/explore", label: "Explore the graveyard" }}>
          Run <code className="font-mono text-xs">pnpm ingest</code> to load popular abandoned repositories from GitHub.
        </StateMessage>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((repo) => (
            <li key={repo.id}><RepoCard repo={repo} /></li>
          ))}
        </ul>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} filters={{}} basePath="/legendary" />
    </div>
  );
}
