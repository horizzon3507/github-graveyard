import type { IssueItem, MonthlyCount, ReleaseInfo, ContributorActivity } from "@/types/github";

export type GraveStatusKey = "active" | "recently_abandoned" | "fading" | "buried" | "ancient";

export interface FactorResult {
  key: string;
  label: string;
  weight: number;
  /** 0..1, where 1 is "most abandoned" for Grave Score and "most revivable" for Revival Score. */
  value: number | null;
  /** Points contributed to the final 0-100 score after renormalising over available factors. */
  points: number;
  available: boolean;
  detail: string;
}

export interface ScoreResult {
  score: number;
  /** Share of total factor weight that had data (0-100). */
  confidence: number;
  factors: FactorResult[];
}

export type Severity = "low" | "medium" | "high";

export interface Signal {
  key: string;
  text: string;
  severity: Severity;
}

export interface CommunitySignal {
  key: string;
  text: string;
  positive: boolean;
}

export interface TechFinding {
  id: string;
  name: string;
  evidence: string;
  category: "framework" | "language" | "runtime" | "build" | "ci" | "library" | "container" | "testing";
  severity: Severity;
  modern: string;
  suggestion: string;
}

export interface DependencyHealth {
  ecosystem: "npm" | "pypi" | null;
  checked: number;
  total: number;
  outdated: { name: string; current: string; latest: string; majorsBehind: number }[];
  deprecated: { name: string; message: string }[];
  /** 0..1 share of checked dependencies that are current and not deprecated. */
  healthyRatio: number | null;
}

export interface LicenseAssessment {
  spdx: string | null;
  name: string | null;
  kind: "permissive" | "weak-copyleft" | "copyleft" | "none" | "other";
  forkFriendly: boolean;
  summary: string;
}

export interface BuildSignal {
  source: "github-actions" | "none";
  conclusion: string | null;
  at: string | null;
  note: string;
}

export interface IssueHighlight {
  number: number;
  title: string;
  url: string;
  comments: number;
  reactions: number;
  labels: string[];
  createdAt: string;
  why: string;
}

export interface IssuesWorthSolving {
  mostRequested: IssueHighlight[];
  easyWins: IssueHighlight[];
  criticalBugs: IssueHighlight[];
  communityRequests: IssueHighlight[];
  sampleSize: number;
  openIssueCount: number | null;
}

export interface RoadmapPhase {
  title: string;
  steps: string[];
}

export interface Challenge {
  text: string;
  severity: Severity;
}

export interface Suggestion {
  text: string;
  kind: "migrate" | "replace" | "upgrade" | "add";
}

/** Shape stored in RepositorySnapshot.data. */
export interface SnapshotData {
  languages: Record<string, number>;
  commitActivity: { monthly: MonthlyCount[]; contributors: ContributorActivity[] } | null;
  releases: ReleaseInfo[];
  releaseCount: number;
  /** Newest issues and pull requests (unbiased recency sample). */
  issueSample: IssueItem[];
  /** Open issues with the most discussion. */
  topOpenIssues: IssueItem[];
  openPullRequests: IssueItem[];
  openPullRequestsTruncated: boolean;
  recentItemsByMonth: { issues: MonthlyCount[]; pullRequests: MonthlyCount[] };
  treeFileCount: number | null;
  readmeExcerpt: string | null;
  manifests: string[];
  totalCommits: number | null;
  totalContributors: number | null;
  maintainerLastActiveAt: string | null;
  topContributor: string | null;
  downloadsLastMonth: number | null;
  workflowRun: { conclusion: string | null; createdAt: string; name: string } | null;
  notes: string[];
  /** Labels of the GitHub requests that failed (rate limit, outage). Their sections may understate reality. */
  failed: string[];
}

export const PARTIAL_PREFIX = "Partial analysis:";

export interface AnalysisResult {
  algorithmVersion: number;
  depth: "QUICK" | "DEEP";
  grave: ScoreResult;
  revival: ScoreResult;
  hiddenGemScore: number;
  communityScore: number;
  difficulty: "EASY" | "MODERATE" | "HARD" | "EXTREME" | null;
  effort: "SMALL" | "MEDIUM" | "LARGE" | null;
  abandonmentSignals: Signal[];
  communitySignals: CommunitySignal[];
  technologies: TechFinding[];
  challenges: Challenge[];
  modernizationSuggestions: Suggestion[];
  roadmap: RoadmapPhase[];
  issuesWorthSolving: IssuesWorthSolving;
  licenseAssessment: LicenseAssessment;
  buildSignal: BuildSignal;
  dependencyHealth: DependencyHealth;
  summary: string | null;
  notes: string[];
}
