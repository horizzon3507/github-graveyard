import Link from "next/link";
import { X } from "lucide-react";
import { FILTER_LABELS, filtersToSearchParams, type ExploreFilters } from "@/features/explore/filters";

export function ActiveFilters({ filters }: { filters: ExploreFilters }) {
  const chips = (Object.keys(FILTER_LABELS) as (keyof ExploreFilters)[]).filter((k) => filters[k] !== undefined);
  if (filters.q) chips.unshift("q");
  if (filters.includeActive) chips.push("includeActive");
  if (chips.length === 0) return null;
  const label = (k: keyof ExploreFilters) => (k === "q" ? "Search" : k === "includeActive" ? "Including active" : FILTER_LABELS[k]);
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Active filters">
      {chips.map((key) => (
        <li key={key}>
          <Link
            href={`/explore?${filtersToSearchParams({ ...filters, page: 1 }, { [key]: undefined }).toString()}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground transition-colors hover:border-white/25"
            aria-label={`Remove filter ${label(key)}`}
          >
            <span className="text-muted-foreground">{label(key)}</span>
            {key !== "includeActive" && <span>{String(filters[key])}</span>}
            <X className="size-3 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
