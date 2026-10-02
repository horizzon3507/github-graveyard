import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SearchBox } from "@/features/home/search-box";
import { CategoryGrid } from "@/features/home/categories";
import { ExampleGraves } from "@/features/home/example-graves";
import { RepoCard } from "@/components/graveyard/repo-card";
import { StateMessage } from "@/components/graveyard/states";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { graveyardStats, listFeatured } from "@/database/repository-queries";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function loadHome() {
  try {
    const [featured, stats] = await Promise.all([listFeatured(6), graveyardStats()]);
    return { featured, stats, failed: false as const };
  } catch (error) {
    console.error("[home] database unavailable", error);
    return { featured: [], stats: { total: 0, deep: 0 }, failed: true as const };
  }
}

export default async function HomePage() {
  const { featured, stats, failed } = await loadHome();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="flex flex-col items-center pt-20 pb-14 text-center sm:pt-28">
        <LogoMark className="mb-6 size-12 text-foreground" />
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">GitHub Graveyard</h1>
        <p className="mt-5 max-w-xl text-balance text-lg text-muted-foreground sm:text-xl">Discover abandoned open-source projects worth bringing back to life.</p>
        <div className="mt-10 w-full max-w-2xl">
          <SearchBox size="lg" />
        </div>
        {stats.total > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{formatNumber(stats.total)}</span> graves catalogued, <span className="font-mono text-foreground">{formatNumber(stats.deep)}</span> fully analyzed.
          </p>
        )}
      </section>

      <section aria-labelledby="browse" className="pb-16">
        <h2 id="browse" className="mb-5 text-sm font-medium text-muted-foreground">
          Browse the graveyard
        </h2>
        <CategoryGrid />
      </section>

      <section aria-labelledby="featured" className="pb-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="featured" className="text-xl font-semibold tracking-tight">
              Worth a second look
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">The code may be dead. The idea isn&apos;t.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/explore">
              View all <ArrowRight />
            </Link>
          </Button>
        </div>
        {failed ? (
          <StateMessage kind="unavailable" title="The graveyard is unreachable">
            We couldn&apos;t reach the database. Check that PostgreSQL is running and <code className="font-mono text-xs">DATABASE_URL</code> is correct.
          </StateMessage>
        ) : featured.length === 0 ? (
          <ExampleGraves />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((repo) => (
              <li key={repo.id}>
                <RepoCard repo={repo} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
