import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "@/components/graveyard/score-ring";

const EXAMPLES = [
  { owner: "example-org", name: "legacy-widgets", description: "A jQuery-era widget toolkit with a loyal following and no commits since 2019.", status: "Buried", grave: 82, revival: 64 },
  { owner: "example-user", name: "pixel-quest", description: "A small roguelike engine. Forks keep appearing, upstream stopped answering.", status: "Fading", grave: 61, revival: 72 },
  { owner: "example-labs", name: "tiny-cli", description: "A fast command-line helper whose idea still has no modern equivalent.", status: "Recently Abandoned", grave: 38, revival: 78 },
];

/** Shown only while the database is empty, so nobody mistakes placeholders for live data. */
export function ExampleGraves() {
  return (
    <div className="space-y-4">
      <div className="surface flex flex-wrap items-center gap-3 border-dashed p-4 text-sm text-muted-foreground">
        <Badge variant="amber">Demo data</Badge>
        <span>
          The graveyard is empty. These are <strong className="text-foreground">example repositories</strong>, not real projects. Run <code className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-xs text-foreground">pnpm ingest</code> or paste a GitHub URL above to
          load real ones.
        </span>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {EXAMPLES.map((e) => (
          <li key={e.name} className="surface flex flex-col gap-4 p-5 opacity-80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{e.owner}</p>
                <h3 className="font-semibold tracking-tight">{e.name}</h3>
              </div>
              <Badge variant="outline">Example repository</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{e.description}</p>
            <div className="mt-auto space-y-2 text-[11px] text-muted-foreground">
              <div className="flex justify-between"><span>{e.status}</span><span className="font-mono text-foreground">Grave {e.grave}</span></div>
              <ScoreBar value={e.grave} tone="grave" />
              <div className="flex justify-between"><span /><span className="font-mono text-foreground">Revival {e.revival}</span></div>
              <ScoreBar value={e.revival} tone="revival" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
