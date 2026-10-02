import type { IssueItem } from "@/types/github";
import type { IssueHighlight, IssuesWorthSolving } from "@/types/analysis";
import { truncate } from "@/lib/utils";

const MAINTENANCE_ASK =
  /(still (being )?maintained|is this (project|repo(sitory)?|library|package)?\s*(still )?(dead|abandoned|alive|maintained|active|deprecated)|(anyone|somebody|someone) (maintaining|taking over|still)|new maintainers?|looking for (a )?maintainers?|(take|taking) over (this|the) (project|repo)|any (plans|news|update)s?|please (update|revive|maintain)|abandon(ed)?\b|deprecated\??|(will|can) (this|it) (be )?(updated|maintained|revived)|fork(ed)? (of this|and continue)|revive|bring (this )?back|continue (this|the) (project|development))/i;
const EASY_LABEL = /(good[ -]first|help[ -]wanted|easy|beginner|starter|trivial|low[ -]hanging|docs?|documentation|typo)/i;
const EASY_TITLE = /(typo|readme|documentation|spelling|broken link|rename|dead link)/i;
const BUG_LABEL = /(bug|crash|security|regression|critical|data[ -]loss|vulnerab|defect)/i;
const BUG_TITLE = /(crash|security|vulnerab|cve-|regression|data loss|segfault|memory leak|exception|fails? to|broken)/i;
const FEATURE_LABEL = /(enhancement|feature|request|proposal|idea)/i;

export function isMaintenanceRequest(issue: Pick<IssueItem, "title" | "body">): boolean {
  return MAINTENANCE_ASK.test(issue.title) || MAINTENANCE_ASK.test(issue.body.slice(0, 400));
}

function highlight(issue: IssueItem, why: string): IssueHighlight {
  return {
    number: issue.number,
    title: truncate(issue.title, 140),
    url: issue.url,
    comments: issue.comments,
    reactions: issue.reactions,
    labels: issue.labels.slice(0, 4),
    createdAt: issue.createdAt,
    why,
  };
}

const engagement = (i: IssueItem) => i.reactions * 2 + i.comments;

export function findIssuesWorthSolving(sample: IssueItem[], openIssueCount: number | null): IssuesWorthSolving {
  const open = sample.filter((i) => !i.isPullRequest && i.state === "open");
  const used = new Set<number>();
  const take = (list: IssueItem[], limit: number, why: (i: IssueItem) => string) => {
    const out: IssueHighlight[] = [];
    for (const issue of list) {
      if (out.length >= limit) break;
      if (used.has(issue.number)) continue;
      used.add(issue.number);
      out.push(highlight(issue, why(issue)));
    }
    return out;
  };

  const criticalBugs = take(
    open
      .filter((i) => i.labels.some((l) => BUG_LABEL.test(l)) || BUG_TITLE.test(i.title))
      .sort((a, b) => engagement(b) - engagement(a)),
    5,
    (i) => (i.reactions > 0 ? `${i.reactions} reactions, ${i.comments} comments` : `${i.comments} comments`) + " on a bug report",
  );

  const communityRequests = take(
    open.filter(isMaintenanceRequest).sort((a, b) => engagement(b) - engagement(a)),
    5,
    () => "Someone is asking about maintenance, updates or a successor",
  );

  const mostRequested = take(
    open
      .filter((i) => i.reactions >= 3 || i.comments >= 5 || (i.labels.some((l) => FEATURE_LABEL.test(l)) && engagement(i) >= 3))
      .sort((a, b) => engagement(b) - engagement(a)),
    5,
    (i) => `${i.reactions} reactions, ${i.comments} comments`,
  );

  const easyWins = take(
    open
      .filter((i) => i.labels.some((l) => EASY_LABEL.test(l)) || EASY_TITLE.test(i.title))
      .sort((a, b) => engagement(b) - engagement(a)),
    5,
    (i) => (i.labels.find((l) => EASY_LABEL.test(l)) ? `Labelled “${i.labels.find((l) => EASY_LABEL.test(l))}”` : "Looks like a small docs or text fix"),
  );

  return { mostRequested, easyWins, criticalBugs, communityRequests, sampleSize: open.length, openIssueCount };
}

export function countMaintenanceRequests(sample: IssueItem[]): number {
  return sample.filter((i) => !i.isPullRequest && i.state === "open" && isMaintenanceRequest(i)).length;
}
