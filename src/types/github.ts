export interface RepoMetadata {
  githubId: number;
  owner: string;
  name: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  license: { spdx: string | null; name: string } | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  sizeKb: number;
  archived: boolean;
  disabled: boolean;
  isPrivate: boolean;
  isFork: boolean;
  parent: string | null;
  defaultBranch: string;
  ownerType: string;
  createdAt: string;
  pushedAt: string;
}

export interface CommitInfo {
  sha: string;
  date: string;
  authorLogin: string | null;
}

export interface ReleaseInfo {
  tag: string;
  name: string | null;
  publishedAt: string;
  prerelease: boolean;
  url: string;
}

export interface IssueItem {
  number: number;
  title: string;
  body: string;
  isPullRequest: boolean;
  state: "open" | "closed";
  comments: number;
  reactions: number;
  labels: string[];
  author: string | null;
  createdAt: string;
  updatedAt: string;
  url: string;
  draft: boolean;
}

export interface ForkInfo {
  fullName: string;
  owner: string;
  name: string;
  htmlUrl: string;
  description: string | null;
  stars: number;
  defaultBranch: string;
  createdAt: string;
  pushedAt: string;
}

export interface ForkComparison {
  aheadBy: number | null;
  behindBy: number | null;
  /** Commits on the fork's default branch during the last 12 months. */
  recentCommits: number;
  lastCommitAt: string | null;
  contributors: number | null;
}

export interface MonthlyCount {
  /** YYYY-MM */
  month: string;
  count: number;
}

export interface ContributorActivity {
  /** Per-author totals and the most recent month with commits. */
  login: string;
  total: number;
  lastCommitAt: string | null;
  recent12m: number;
}

export interface CommitActivity {
  monthly: MonthlyCount[];
  contributors: ContributorActivity[];
}

export interface WorkflowRun {
  conclusion: string | null;
  status: string;
  createdAt: string;
  name: string;
  url: string;
}

export interface TreeListing {
  paths: string[];
  truncated: boolean;
}

export interface SearchResultPage {
  totalCount: number;
  items: RepoMetadata[];
}

export interface Paged<T> {
  items: T[];
  /** Total number of results when GitHub reports it (via Link header). */
  total: number | null;
}

export type Pending<T> = { pending: true } | { pending: false; data: T };

export interface GitHubProvider {
  getRepository(owner: string, name: string): Promise<RepoMetadata>;
  getLastCommit(owner: string, name: string, branch?: string): Promise<{ commit: CommitInfo | null; totalCommits: number | null }>;
  getReleases(owner: string, name: string): Promise<{ releases: ReleaseInfo[]; total: number }>;
  listIssues(owner: string, name: string, opts: { state: "open" | "all"; pages: number; sort?: "created" | "updated" | "comments" }): Promise<IssueItem[]>;
  listOpenPullRequests(owner: string, name: string): Promise<{ items: IssueItem[]; truncated: boolean }>;
  getLanguages(owner: string, name: string): Promise<Record<string, number>>;
  getCommitActivity(owner: string, name: string): Promise<Pending<CommitActivity>>;
  getContributorCount(owner: string, name: string): Promise<number | null>;
  listForks(owner: string, name: string, limit: number): Promise<Paged<ForkInfo>>;
  inspectFork(owner: string, name: string, baseBranch: string, fork: ForkInfo): Promise<ForkComparison>;
  getTree(owner: string, name: string, branch: string): Promise<TreeListing>;
  getFile(owner: string, name: string, branch: string, path: string): Promise<string | null>;
  getLatestWorkflowRun(owner: string, name: string): Promise<WorkflowRun | null>;
  getUserLastActivity(login: string): Promise<string | null>;
  searchRepositories(query: string, opts: { sort?: "stars" | "updated" | "forks"; page?: number; perPage?: number }): Promise<SearchResultPage>;
}
