"use client";

import { ExternalLink, MessageSquare, SmilePlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatAgo } from "@/lib/utils";
import type { IssueHighlight, IssuesWorthSolving } from "@/types/analysis";

const TABS: { key: keyof Pick<IssuesWorthSolving, "mostRequested" | "easyWins" | "criticalBugs" | "communityRequests">; label: string; empty: string }[] = [
  { key: "mostRequested", label: "Most Requested", empty: "No open issue stands out by reactions or discussion." },
  { key: "easyWins", label: "Easy Wins", empty: "No issues labelled as beginner friendly or simple fixes were found." },
  { key: "criticalBugs", label: "Critical Bugs", empty: "No open bug reports with crash, security or regression signals were found." },
  { key: "communityRequests", label: "Community Requests", empty: "Nobody is asking about maintenance in the issues we sampled." },
];

function IssueRow({ issue }: { issue: IssueHighlight }) {
  return (
    <li className="surface grid gap-1.5 p-4">
      <a href={issue.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 text-sm font-medium hover:text-grave-green">
        <span className="font-mono text-muted-foreground">#{issue.number}</span>
        <span className="min-w-0 break-words">{issue.title}</span>
        <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
      </a>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><SmilePlus className="size-3.5" /> {issue.reactions}</span>
        <span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" /> {issue.comments}</span>
        <span>opened {formatAgo(issue.createdAt)}</span>
        <span>{issue.why}</span>
      </div>
      {issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {issue.labels.map((l) => (
            <Badge key={l} variant="muted">{l}</Badge>
          ))}
        </div>
      )}
    </li>
  );
}

export function IssuesWorth({ issues, deep }: { issues: IssuesWorthSolving; deep: boolean }) {
  if (!deep) return <p className="surface p-5 text-sm text-muted-foreground">Issues are analyzed by the full analysis.</p>;
  const first = TABS.find((t) => issues[t.key].length > 0)?.key ?? "mostRequested";
  return (
    <div className="space-y-3">
      <Tabs defaultValue={first}>
        <TabsList aria-label="Issue categories">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label} <span className="font-mono text-xs text-muted-foreground">{issues[t.key].length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            {issues[t.key].length === 0 ? <p className="surface p-5 text-sm text-muted-foreground">{t.empty}</p> : <ul className="grid gap-3">{issues[t.key].map((i) => <IssueRow key={i.number} issue={i} />)}</ul>}
          </TabsContent>
        ))}
      </Tabs>
      <p className="text-xs text-muted-foreground">Based on a sample of {issues.sampleSize} open issues out of {issues.openIssueCount ?? "?"} open issues and pull requests. Highlights are heuristics from labels, reactions and wording.</p>
    </div>
  );
}
