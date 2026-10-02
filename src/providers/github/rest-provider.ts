import type {
  CommitActivity,
  CommitInfo,
  ForkComparison,
  ForkInfo,
  GitHubProvider,
  IssueItem,
  Paged,
  Pending,
  ReleaseInfo,
  RepoMetadata,
  SearchResultPage,
  TreeListing,
  WorkflowRun,
} from "@/types/github";
import { GitHubClient, lastPageFromLink } from "@/providers/github/client";
import { GitHubNotFoundError, GitHubPrivateError, AppError } from "@/lib/errors";
import { monthKey } from "@/analysis/activity";

/* eslint-disable @typescript-eslint/no-explicit-any */

const HOUR = 3600;

function mapRepo(r: any): RepoMetadata {
  return {
    githubId: r.id,
    owner: r.owner.login,
    name: r.name,
    description: r.description ?? null,
    htmlUrl: r.html_url,
    homepage: r.homepage || null,
    language: r.language ?? null,
    topics: Array.isArray(r.topics) ? r.topics : [],
    license: r.license ? { spdx: r.license.spdx_id && r.license.spdx_id !== "NOASSERTION" ? r.license.spdx_id : null, name: r.license.name } : null,
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
    watchers: r.subscribers_count ?? r.watchers_count ?? 0,
    openIssues: r.open_issues_count ?? 0,
    sizeKb: r.size ?? 0,
    archived: Boolean(r.archived),
    disabled: Boolean(r.disabled),
    isPrivate: Boolean(r.private),
    isFork: Boolean(r.fork),
    parent: r.parent?.full_name ?? null,
    root: r.source?.full_name ?? null,
    defaultBranch: r.default_branch ?? "main",
    ownerType: r.owner.type ?? "User",
    createdAt: r.created_at,
    pushedAt: r.pushed_at ?? r.updated_at ?? r.created_at,
  };
}

function mapIssue(i: any, keepBody: boolean): IssueItem {
  const isPullRequest = Boolean(i.pull_request) || typeof i.merged_at !== "undefined" || typeof i.head === "object";
  return {
    number: i.number,
    title: String(i.title ?? ""),
    body: keepBody && !isPullRequest ? String(i.body ?? "").slice(0, 300) : "",
    isPullRequest,
    state: i.state === "closed" ? "closed" : "open",
    comments: i.comments ?? 0,
    reactions: i.reactions?.total_count ?? 0,
    labels: (i.labels ?? []).map((l: any) => (typeof l === "string" ? l : l.name)).filter(Boolean),
    author: i.user?.login ?? null,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    url: i.html_url,
    draft: Boolean(i.draft),
  };
}

export class RestGitHubProvider implements GitHubProvider {
  constructor(private readonly client: GitHubClient) {}

  async getRepository(owner: string, name: string): Promise<RepoMetadata> {
    const data = await this.client.notFoundGuard<any>(`/repos/${owner}/${name}`, "Repository", { ttl: HOUR });
    const repo = mapRepo(data);
    if (repo.isPrivate) throw new GitHubPrivateError();
    return repo;
  }

  async getLastCommit(owner: string, name: string, branch?: string) {
    const sha = branch ? `&sha=${encodeURIComponent(branch)}` : "";
    const res = await this.client.request<any[]>(`/repos/${owner}/${name}/commits?per_page=1${sha}`, { ttl: HOUR });
    if (res.status === 409 || res.status === 404 || !res.data || res.data.length === 0) return { commit: null, totalCommits: 0 };
    const c = res.data[0];
    const commit: CommitInfo = {
      sha: c.sha,
      date: c.commit?.committer?.date ?? c.commit?.author?.date,
      authorLogin: c.author?.login ?? null,
    };
    return { commit, totalCommits: lastPageFromLink(res.link) ?? res.data.length };
  }

  async getReleases(owner: string, name: string) {
    const res = await this.client.request<any[]>(`/repos/${owner}/${name}/releases?per_page=100`, { ttl: 6 * HOUR });
    const releases: ReleaseInfo[] = (res.data ?? [])
      .filter((r) => !r.draft && r.published_at)
      .map((r) => ({ tag: r.tag_name, name: r.name ?? null, publishedAt: r.published_at, prerelease: Boolean(r.prerelease), url: r.html_url }));
    return { releases, total: releases.length };
  }

  async listIssues(owner: string, name: string, opts: { state: "open" | "all"; pages: number; sort?: "created" | "updated" | "comments" }) {
    const out: IssueItem[] = [];
    const sort = opts.sort ?? "created";
    for (let page = 1; page <= opts.pages; page++) {
      const res = await this.client.request<any[]>(`/repos/${owner}/${name}/issues?state=${opts.state}&sort=${sort}&direction=desc&per_page=100&page=${page}`, { ttl: 6 * HOUR });
      const items = res.data ?? [];
      out.push(...items.map((i) => mapIssue(i, opts.state === "open" || i.state === "open")));
      if (items.length < 100) break;
    }
    return out;
  }

  async listOpenPullRequests(owner: string, name: string) {
    const res = await this.client.request<any[]>(`/repos/${owner}/${name}/pulls?state=open&per_page=100`, { ttl: 6 * HOUR });
    const raw = res.data ?? [];
    return {
      items: raw.map((p) => ({ ...mapIssue({ ...p, pull_request: {} }, false), comments: 0 })),
      truncated: raw.length >= 100,
    };
  }

  async getLanguages(owner: string, name: string) {
    const res = await this.client.request<Record<string, number>>(`/repos/${owner}/${name}/languages`, { ttl: 24 * HOUR });
    return res.data ?? {};
  }

  async getCommitActivity(owner: string, name: string): Promise<Pending<CommitActivity>> {
    let res = await this.client.request<any[]>(`/repos/${owner}/${name}/stats/contributors`, { ttl: 12 * HOUR, allowAccepted: true });
    for (let attempt = 0; attempt < 3 && res.status === 202; attempt++) {
      await new Promise((r) => setTimeout(r, 2500));
      res = await this.client.request<any[]>(`/repos/${owner}/${name}/stats/contributors`, { ttl: 12 * HOUR, allowAccepted: true });
    }
    if (res.status === 202) return { pending: true };
    if (!Array.isArray(res.data) || res.data.length === 0) return { pending: false, data: { monthly: [], contributors: [] } };

    const monthly = new Map<string, number>();
    const yearAgo = Date.now() - 365 * 86_400_000;
    const contributors = res.data.map((entry: any) => {
      let recent12m = 0;
      let lastCommitAt: string | null = null;
      for (const week of entry.weeks ?? []) {
        if (!week.c) continue;
        const date = new Date(week.w * 1000);
        const key = monthKey(date);
        monthly.set(key, (monthly.get(key) ?? 0) + week.c);
        if (date.getTime() >= yearAgo) recent12m += week.c;
        lastCommitAt = date.toISOString();
      }
      return { login: entry.author?.login ?? "unknown", total: entry.total ?? 0, lastCommitAt, recent12m };
    });
    contributors.sort((a, b) => b.total - a.total);
    return {
      pending: false,
      data: {
        monthly: [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
        contributors: contributors.slice(0, 30),
      },
    };
  }

  async getContributorCount(owner: string, name: string) {
    const res = await this.client.request<any[]>(`/repos/${owner}/${name}/contributors?per_page=1&anon=true`, { ttl: 12 * HOUR });
    if (!res.data) return null;
    return lastPageFromLink(res.link) ?? res.data.length;
  }

  async listForks(owner: string, name: string, limit: number): Promise<Paged<ForkInfo>> {
    const res = await this.client.request<any[]>(`/repos/${owner}/${name}/forks?sort=stargazers&per_page=${Math.min(100, Math.max(1, limit))}`, { ttl: 6 * HOUR });
    const items: ForkInfo[] = (res.data ?? []).map((f) => ({
      fullName: f.full_name,
      owner: f.owner.login,
      name: f.name,
      htmlUrl: f.html_url,
      description: f.description ?? null,
      stars: f.stargazers_count ?? 0,
      defaultBranch: f.default_branch ?? "main",
      createdAt: f.created_at,
      pushedAt: f.pushed_at ?? f.created_at,
    }));
    return { items, total: null };
  }

  async inspectFork(owner: string, name: string, baseBranch: string, fork: ForkInfo): Promise<ForkComparison> {
    const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
    const [compare, commits, contributors] = await Promise.all([
      this.client
        .request<any>(`/repos/${owner}/${name}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(fork.owner)}:${encodeURIComponent(fork.defaultBranch)}?per_page=1`, { ttl: 6 * HOUR })
        .catch(() => null),
      this.client.request<any[]>(`/repos/${fork.fullName}/commits?since=${encodeURIComponent(since)}&per_page=1`, { ttl: 6 * HOUR }).catch(() => null),
      this.client.request<any[]>(`/repos/${fork.fullName}/contributors?per_page=1&anon=true`, { ttl: 12 * HOUR }).catch(() => null),
    ]);
    const recentList = commits?.data ?? [];
    return {
      aheadBy: compare?.data?.ahead_by ?? null,
      behindBy: compare?.data?.behind_by ?? null,
      recentCommits: recentList.length === 0 ? 0 : (lastPageFromLink(commits?.link ?? null) ?? recentList.length),
      lastCommitAt: recentList[0]?.commit?.committer?.date ?? null,
      contributors: contributors?.data ? (lastPageFromLink(contributors.link) ?? contributors.data.length) : null,
    };
  }

  async getTree(owner: string, name: string, branch: string): Promise<TreeListing> {
    const res = await this.client.request<any>(`/repos/${owner}/${name}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { ttl: 24 * HOUR });
    if (!res.data?.tree) return { paths: [], truncated: false };
    return {
      paths: res.data.tree.filter((n: any) => n.type === "blob").map((n: any) => n.path as string).slice(0, 30_000),
      truncated: Boolean(res.data.truncated),
    };
  }

  async getFile(owner: string, name: string, branch: string, path: string) {
    const url = `https://raw.githubusercontent.com/${owner}/${name}/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`;
    return this.client.raw(url);
  }

  async getLatestWorkflowRun(owner: string, name: string): Promise<WorkflowRun | null> {
    const res = await this.client.request<any>(`/repos/${owner}/${name}/actions/runs?per_page=1`, { ttl: 24 * HOUR });
    const run = res.data?.workflow_runs?.[0];
    if (!run) return null;
    return { conclusion: run.conclusion ?? null, status: run.status, createdAt: run.created_at, name: run.name ?? "workflow", url: run.html_url };
  }

  async getUserLastActivity(login: string) {
    const res = await this.client.request<any[]>(`/users/${encodeURIComponent(login)}/events/public?per_page=1`, { ttl: 12 * HOUR });
    return res.data?.[0]?.created_at ?? null;
  }

  async isPublicOrgMember(org: string, login: string) {
    const res = await this.client.request<unknown>(`/orgs/${encodeURIComponent(org)}/public_members/${encodeURIComponent(login)}`, { ttl: HOUR });
    return res.status === 200 || res.status === 204;
  }

  async searchRepositories(query: string, opts: { sort?: "stars" | "updated" | "forks"; page?: number; perPage?: number }): Promise<SearchResultPage> {
    const params = new URLSearchParams({ q: query, per_page: String(opts.perPage ?? 50), page: String(opts.page ?? 1) });
    if (opts.sort) {
      params.set("sort", opts.sort);
      params.set("order", "desc");
    }
    const res = await this.client.request<any>(`/search/repositories?${params}`, { ttl: 12 * HOUR });
    if (res.status === 422) throw new AppError("invalid_input", "GitHub rejected this search query.");
    if (!res.data) throw new GitHubNotFoundError("Search results");
    return { totalCount: res.data.total_count ?? 0, items: (res.data.items ?? []).map(mapRepo).filter((r: RepoMetadata) => !r.isPrivate) };
  }
}
