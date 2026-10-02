import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { filtersToSearchParams, type ExploreFilters } from "@/features/explore/filters";

export function Pagination({ page, pageCount, filters, basePath }: { page: number; pageCount: number; filters: Partial<ExploreFilters>; basePath: string }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const q = filtersToSearchParams(filters, { page: p }).toString();
    return q ? `${basePath}?${q}` : basePath;
  };
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-3">
      <Button asChild variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-40" : ""} aria-disabled={page <= 1}>
        <Link href={href(page - 1)} rel="prev" tabIndex={page <= 1 ? -1 : 0}>
          <ChevronLeft /> Previous
        </Link>
      </Button>
      <span className="text-sm text-muted-foreground">
        Page <span className="font-mono text-foreground">{page}</span> of <span className="font-mono">{pageCount}</span>
      </span>
      <Button asChild variant="secondary" size="sm" className={page >= pageCount ? "pointer-events-none opacity-40" : ""} aria-disabled={page >= pageCount}>
        <Link href={href(page + 1)} rel="next" tabIndex={page >= pageCount ? -1 : 0}>
          Next <ChevronRight />
        </Link>
      </Button>
    </nav>
  );
}
