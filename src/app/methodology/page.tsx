import type { Metadata } from "next";
import { GRAVE_WEIGHTS } from "@/analysis/grave-score";
import { REVIVAL_WEIGHTS } from "@/analysis/revival-score";
import { STATUS_META, STATUS_ORDER } from "@/analysis/status";
import { thresholds } from "@/config/graveyard";

export const metadata: Metadata = { title: "How the scores work", description: "The formulas behind Grave Score, Revival Score, Hidden Gems and the analysis." };

const GRAVE_LABELS: Record<keyof typeof GRAVE_WEIGHTS, string> = {
  lastCommit: "Time since last commit. Logarithmic: 0 when fresh, 1 at five years.",
  lastRelease: "Time since last release, same curve. Neutral (0.5) when the project never published a release.",
  unansweredIssues: "Share and volume of sampled open issues with zero comments.",
  stalePullRequests: "Share of open pull requests untouched for a year, scaled by how many are open.",
  commitDecline: "1 minus the last 12 months of commits divided by the busiest 12 months ever.",
  maintainerActivity: "Whether the top contributor has any public GitHub activity (GitHub exposes 90 days of events).",
  readmeNotice: "README says it is unmaintained or deprecated (1), or announces a move or a search for maintainers (0.6).",
  archived: "The owner archived the repository. Also sets a floor of 50 on the whole score.",
  activeContributors: "Contributors who committed in the last 12 months: 0 → 1, 1 → 0.6, 2 → 0.3, 3–4 → 0.1, 5+ → 0.",
};

const REVIVAL_LABELS: Record<keyof typeof REVIVAL_WEIGHTS, string> = {
  stars: "Stars on a log scale (20,000+ is the ceiling).",
  forks: "Forks on a log scale (3,000+ is the ceiling).",
  downloads: "Monthly npm downloads on a log scale, when the repository publishes an npm package.",
  recentIssues: "Issues opened in the last 12 months (30+ is the ceiling).",
  maintenanceRequests: "Open issues that ask whether the project is alive, maintained or can be taken over (5+ is the ceiling).",
  recentPullRequests: "Pull requests opened in the last 12 months (10+ is the ceiling).",
  documentation: "README length, install and usage sections, docs folder, contributing guide or changelog.",
  tests: "Test files found (0.6) plus CI configuration (0.4).",
  license: "Permissive 1.0, weak copyleft 0.75, copyleft 0.6, unrecognised 0.25, none 0.05.",
  codeSize: "Smaller code is easier to take over. 50 KB scores 1, about 20 MB scores 0.",
  complexity: "Number of languages and file count.",
  techDebt: "Obsolete technologies found in manifests. Each adds 1 to 3 debt points; 12 or more scores 0.",
  dependencyHealth: "Share of checked npm / PyPI dependencies that are neither deprecated nor a major version behind.",
  community: "Contributors (log scale) and active forks (5+ is the ceiling).",
};

function WeightTable({ weights, labels }: { weights: Record<string, number>; labels: Record<string, string> }) {
  return (
    <div className="surface overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr><th className="px-4 py-2.5 font-medium">Factor</th><th className="w-16 px-4 py-2.5 font-medium">Weight</th><th className="hidden px-4 py-2.5 font-medium sm:table-cell">How it is measured</th></tr>
        </thead>
        <tbody>
          {Object.entries(weights).map(([key, weight]) => (
            <tr key={key} className="border-b border-border last:border-0 align-top">
              <td className="px-4 py-2.5 font-mono text-xs">{key}<p className="mt-1 font-sans text-xs text-muted-foreground sm:hidden">{labels[key]}</p></td>
              <td className="px-4 py-2.5 font-mono">{weight}</td>
              <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">{labels[key]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-12 px-4 py-12 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">How the scores work</h1>
        <p className="text-muted-foreground">
          Every number on this site is calculated by GitHub Graveyard from public GitHub data and a few public package registries. They are estimates meant to help you decide where to look, not objective truth. A project can be finished rather than dead, and a busy one can still be in trouble.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Status bands</h2>
        <p className="text-sm text-muted-foreground">Based on the time since the last commit. The bands are configurable with <code className="font-mono text-xs">GRAVEYARD_STATUS_THRESHOLDS</code>. Archived repositories are at least <em>Recently Abandoned</em>. A repository with a registered resurrection also shows <em>Resurrected</em>.</p>
        <ul className="surface grid divide-y divide-border">
          {STATUS_ORDER.map((s) => (
            <li key={s} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-sm"><span className="font-medium">{STATUS_META[s].label}</span><span className="text-muted-foreground">{STATUS_META[s].description(thresholds)}</span></li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Grave Score (0–100)</h2>
        <p className="text-sm text-muted-foreground">How abandoned a project looks. Higher means more abandoned. The score is the weighted average of the factors below. Factors that could not be measured are left out and the remaining weights are rescaled, which is why each score shows a confidence value (the share of weight that had data). A quick scan only knows the first and the archived factors.</p>
        <WeightTable weights={GRAVE_WEIGHTS} labels={GRAVE_LABELS} />
        <p className="font-mono text-xs text-muted-foreground">score = round(100 × Σ(weight × value) ÷ Σ(weight of available factors))</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Revival Score (0–100)</h2>
        <p className="text-sm text-muted-foreground">How promising a revival looks, with the same renormalisation. High stars, a friendly license, small code, tests, good docs and an engaged community push it up. Obsolete technology and deprecated dependencies push it down. When less than 60% of the weight has data (a quick scan, which only sees popularity, license and size), the score is pulled toward 50 in proportion to what is missing, so a famous repository is not mistaken for an easy one.</p>
        <WeightTable weights={REVIVAL_WEIGHTS} labels={REVIVAL_LABELS} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Hidden Gem score</h2>
        <p className="text-sm text-muted-foreground">Used by the Hidden Gems page. It rewards projects that are abandoned enough, popular enough and not yet continued by anyone.</p>
        <p className="surface px-4 py-3 font-mono text-xs leading-relaxed">100 × (0.30 × revival + 0.20 × abandonment fit + 0.20 × stars fit + 0.15 × no active fork + 0.15 × compact code)</p>
        <p className="text-sm text-muted-foreground">Abandonment fit ramps from 6 to 24 months. Stars fit starts at 50 stars and peaks around 1,000. Pages only list repositories quiet for over a year, with a license and at most 2 active forks.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Difficulty and effort</h2>
        <p className="text-sm text-muted-foreground">
          Points add up from technology debt (1 to 3 per obsolete technology), deprecated dependencies (up to 3), dependencies two or more majors behind (up to 3), missing tests (2), missing CI (1), code size (up to 3), more than three languages (1) and more than five years of silence (1). 0–3 is Easy, 4–7 Moderate, 8–12 Hard, 13+ Extreme. Effort is Small, Medium or Large from code size and difficulty.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">What we cannot know</h2>
        <ul className="grid list-disc gap-2 pl-5 text-sm text-muted-foreground">
          <li>We never compile or run code. “Does it still build?” is answered with the last CI run and dependency health, which are hints.</li>
          <li>Issue and pull request statistics use samples (the newest 200 items, the 100 most discussed open issues, up to 100 open pull requests). Pages say when a number is a lower bound.</li>
          <li>Active forks are found among the top 30 forks by stars; a busy fork with no stars may be missed.</li>
          <li>Maintainer activity uses GitHub public events, which only cover the last 90 days. Private work is invisible.</li>
          <li>Technology archaeology reads manifest files at the repository root (package.json, requirements.txt, Dockerfile, go.mod, Cargo.toml and others). Monorepos can hide things.</li>
          <li>Licenses are summarised, not interpreted. This is not legal advice.</li>
        </ul>
      </section>
    </article>
  );
}
