import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_KEYS, CATEGORY_LABELS } from "@/analysis/categories";
import { STATUS_META, STATUS_ORDER } from "@/analysis/status";
import type { ExploreFilters } from "@/features/explore/filters";

const selectClass = "h-9 w-full rounded-lg border border-input bg-muted/50 px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function Range({ label, min, max, filters, step }: { label: string; min: keyof ExploreFilters; max: keyof ExploreFilters; filters: ExploreFilters; step?: string }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-xs text-muted-foreground">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" inputMode="decimal" min={0} step={step} name={min} defaultValue={(filters[min] as number | undefined) ?? ""} placeholder="Min" aria-label={`${label} minimum`} />
        <Input type="number" inputMode="decimal" min={0} step={step} name={max} defaultValue={(filters[max] as number | undefined) ?? ""} placeholder="Max" aria-label={`${label} maximum`} />
      </div>
    </fieldset>
  );
}

function Group({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group border-b border-border py-3 last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium outline-none focus-visible:text-grave-green [&::-webkit-details-marker]:hidden">
        {title}
        <span className="text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true">›</span>
      </summary>
      <div className="mt-3 grid gap-3">{children}</div>
    </details>
  );
}

function FilterForm({ filters, languages, licenses }: { filters: ExploreFilters; languages: string[]; licenses: string[] }) {
  return (
    <form action="/explore" method="get" className="grid gap-1">
      {filters.sort !== "most-starred" && <input type="hidden" name="sort" value={filters.sort} />}
      <Group title="Search" open>
        <Field label="Keywords">
          <Input name="q" defaultValue={filters.q ?? ""} placeholder="name, description, topic, owner" maxLength={200} />
        </Field>
        <Field label="Language">
          <select name="language" defaultValue={filters.language ?? ""} className={selectClass}>
            <option value="">Any</option>
            {languages.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
            {filters.language && !languages.includes(filters.language) && <option value={filters.language}>{filters.language}</option>}
          </select>
        </Field>
        <Field label="Category">
          <select name="category" defaultValue={filters.category ?? ""} className={selectClass}>
            <option value="">Any</option>
            {CATEGORY_KEYS.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Topic">
            <Input name="topic" defaultValue={filters.topic ?? ""} placeholder="e.g. cli" maxLength={50} />
          </Field>
          <Field label="Owner">
            <Input name="owner" defaultValue={filters.owner ?? ""} placeholder="e.g. facebook" maxLength={39} />
          </Field>
        </div>
      </Group>

      <Group title="Abandonment" open>
        <Field label="Status">
          <select name="status" defaultValue={filters.status ?? ""} className={selectClass}>
            <option value="">Any abandoned</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </Field>
        <Range label="Years abandoned" min="minYears" max="maxYears" filters={filters} step="0.5" />
        <Field label="Last commit before">
          <Input type="date" name="lastCommitBefore" defaultValue={filters.lastCommitBefore ?? ""} />
        </Field>
        <Field label="Last commit after">
          <Input type="date" name="lastCommitAfter" defaultValue={filters.lastCommitAfter ?? ""} />
        </Field>
        <Field label="Last release before">
          <Input type="date" name="lastReleaseBefore" defaultValue={filters.lastReleaseBefore ?? ""} />
        </Field>
        <Field label="Last release after">
          <Input type="date" name="lastReleaseAfter" defaultValue={filters.lastReleaseAfter ?? ""} />
        </Field>
        <Field label="Archived">
          <select name="archived" defaultValue={filters.archived ?? ""} className={selectClass}>
            <option value="">Include archived</option>
            <option value="only">Archived only</option>
            <option value="exclude">Exclude archived</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="includeActive" value="1" defaultChecked={filters.includeActive === "1"} className="size-4 accent-[#6ee7a8]" />
          Include active repositories
        </label>
      </Group>

      <Group title="Popularity">
        <Range label="Stars" min="minStars" max="maxStars" filters={filters} />
        <Range label="Forks" min="minForks" max="maxForks" filters={filters} />
        <Range label="Open issues" min="minIssues" max="maxIssues" filters={filters} />
        <Field label="Has active forks">
          <select name="hasActiveForks" defaultValue={filters.hasActiveForks ?? ""} className={selectClass}>
            <option value="">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
      </Group>

      <Group title="Scores">
        <Range label="Grave Score" min="minGrave" max="maxGrave" filters={filters} />
        <Range label="Revival Score" min="minRevival" max="maxRevival" filters={filters} />
        <Field label="Difficulty">
          <select name="difficulty" defaultValue={filters.difficulty ?? ""} className={selectClass}>
            <option value="">Any</option>
            <option value="EASY">Easy</option>
            <option value="MODERATE">Moderate</option>
            <option value="HARD">Hard</option>
            <option value="EXTREME">Extreme</option>
          </select>
        </Field>
      </Group>

      <Group title="Repository">
        <Field label="License">
          <select name="license" defaultValue={filters.license ?? ""} className={selectClass}>
            <option value="">Any</option>
            <option value="none">No license</option>
            {licenses.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Range label="Size (MB)" min="minSizeMb" max="maxSizeMb" filters={filters} />
      </Group>

      <div className="sticky bottom-0 flex gap-2 bg-background/90 py-3 backdrop-blur">
        <Button type="submit" className="flex-1">Apply filters</Button>
        <Button asChild variant="ghost">
          <a href="/explore">Reset</a>
        </Button>
      </div>
    </form>
  );
}

export function FilterPanel({ filters, languages, licenses }: { filters: ExploreFilters; languages: string[]; licenses: string[] }) {
  return (
    <>
      <details className="surface lg:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="size-4" /> Filters
        </summary>
        <div className="px-4 pb-2">
          <FilterForm filters={filters} languages={languages} licenses={licenses} />
        </div>
      </details>
      <aside className="hidden lg:block" aria-label="Filters">
        <div className="surface sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto px-4 py-1">
          <FilterForm filters={filters} languages={languages} licenses={licenses} />
        </div>
      </aside>
    </>
  );
}
