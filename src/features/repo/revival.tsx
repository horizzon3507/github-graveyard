import { ArrowRight, CheckCircle2, CircleAlert, Hammer, Scale, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatAgo } from "@/lib/utils";
import type { RepoAnalysis } from "@/features/repo/analysis-data";

const DIFFICULTY = {
  EASY: { label: "Easy", variant: "green" as const, text: "Mostly a matter of pulling in the latest tooling." },
  MODERATE: { label: "Moderate", variant: "blue" as const, text: "Some obsolete parts to replace, but nothing blocking." },
  HARD: { label: "Hard", variant: "purple" as const, text: "Expect real migration work before a first release." },
  EXTREME: { label: "Extreme", variant: "red" as const, text: "A rewrite in all but name. Only for the committed." },
};

const EFFORT = { SMALL: "Small project", MEDIUM: "Medium project", LARGE: "Large project" };
const SUGGESTION_ICON = { migrate: "Migrate", replace: "Replace", upgrade: "Upgrade", add: "Add" } as const;

export function RevivalAnalysis({ analysis }: { analysis: RepoAnalysis }) {
  const d = analysis.difficulty ? DIFFICULTY[analysis.difficulty] : null;
  const build = analysis.buildSignal;
  const deps = analysis.dependencyHealth;

  if (!d) {
    return <p className="surface p-5 text-sm text-muted-foreground">Difficulty and modernization advice need the full analysis, which is still running or queued.</p>;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface space-y-2 p-5">
          <p className="text-xs text-muted-foreground">Difficulty</p>
          <Badge variant={d.variant} className="text-sm">{d.label}</Badge>
          <p className="text-sm text-muted-foreground">{d.text}</p>
        </div>
        <div className="surface space-y-2 p-5">
          <p className="text-xs text-muted-foreground">Estimated modernization effort</p>
          <p className="text-lg font-semibold tracking-tight">{analysis.effort ? EFFORT[analysis.effort] : "Unknown"}</p>
          <p className="text-sm text-muted-foreground">Based on code size, technology debt and missing safety nets.</p>
        </div>
        <div className="surface space-y-2 p-5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Scale className="size-3.5" /> Can you continue it?</p>
          <p className="text-lg font-semibold tracking-tight">{analysis.license.forkFriendly ? "Yes, license allows it" : analysis.license.kind === "none" ? "Ask the owners first" : "Read the license"}</p>
          <p className="text-sm text-muted-foreground">{analysis.license.summary}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface space-y-3 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><CircleAlert className="size-4 text-grave-purple" /> Main challenges</h3>
          {analysis.challenges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No major obstacles detected.</p>
          ) : (
            <ul className="grid gap-2">
              {analysis.challenges.map((c) => (
                <li key={c.text} className="flex items-start gap-2.5 text-sm">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", c.severity === "high" ? "bg-grave-purple" : c.severity === "medium" ? "bg-grave-blue" : "bg-muted-foreground")} />
                  {c.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface space-y-3 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Hammer className="size-4 text-grave-green" /> If you wanted to revive this project today</h3>
          {analysis.suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing obvious to modernize from the files we could read.</p>
          ) : (
            <ul className="grid gap-2">
              {analysis.suggestions.map((s) => (
                <li key={s.text} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-grave-green/70" />
                  <span>
                    <span className="sr-only">{SUGGESTION_ICON[s.kind]}: </span>
                    {s.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Automatic technical analysis based on manifest files. Verify before you plan around it.</p>
        </div>
      </div>

      <div className="surface grid gap-4 p-5 text-sm md:grid-cols-2">
        <div className="space-y-1.5">
          <h3 className="flex items-center gap-2 font-semibold"><ShieldQuestion className="size-4 text-muted-foreground" /> Does it still build?</h3>
          <p className="text-muted-foreground">
            {build.source === "github-actions" ? (
              <>
                Last CI run <strong className={build.conclusion === "success" ? "text-grave-green" : "text-foreground"}>{build.conclusion ?? "in progress"}</strong> {formatAgo(build.at)}.{" "}
              </>
            ) : null}
            {build.note}
          </p>
        </div>
        <div className="space-y-1.5">
          <h3 className="font-semibold">Dependency health</h3>
          {deps.checked === 0 ? (
            <p className="text-muted-foreground">No npm or PyPI manifest to check.</p>
          ) : (
            <>
              <p className="text-muted-foreground">
                Checked {deps.checked} of {deps.total} dependencies against the registry: <strong className="text-foreground">{deps.outdated.length}</strong> behind a major version, <strong className="text-foreground">{deps.deprecated.length}</strong> deprecated.
              </p>
              {deps.deprecated.length > 0 && (
                <ul className="text-xs text-muted-foreground">
                  {deps.deprecated.slice(0, 4).map((x) => (
                    <li key={x.name}><span className="font-mono text-grave-purple">{x.name}</span>: {x.message}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function TechnologyArchaeology({ analysis }: { analysis: RepoAnalysis }) {
  const finds = analysis.technologies;
  if (analysis.depth === "QUICK") return <p className="surface p-5 text-sm text-muted-foreground">The dig starts once the full analysis finishes.</p>;
  if (finds.length === 0) {
    return (
      <p className="surface p-5 text-sm text-muted-foreground">
        Nothing from the Stone Age. No obsolete technologies turned up in the manifests we read (package.json, requirements.txt, Dockerfile, CI configs and a few more).
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {finds.map((f) => (
        <li key={f.id} className="surface space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">{f.name}</p>
            <Badge variant={f.severity === "high" ? "purple" : f.severity === "medium" ? "blue" : "muted"}>{f.severity === "high" ? "Fossil" : f.severity === "medium" ? "Relic" : "Antique"}</Badge>
          </div>
          <p className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Modern equivalent</span> <ArrowRight className="size-3.5 text-muted-foreground" /> <span className="text-grave-green">{f.modern}</span>
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">Found in {f.evidence}</p>
        </li>
      ))}
    </ul>
  );
}
