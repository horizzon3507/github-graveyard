import { describe, expect, it, vi } from "vitest";
import { GitHubClient, lastPageFromLink } from "@/providers/github/client";
import { MemoryCacheStore } from "@/providers/github/cache";
import { GitHubNotFoundError, GitHubRateLimitError, GitHubUnavailableError } from "@/lib/errors";
import { RestGitHubProvider } from "@/providers/github/rest-provider";

const ok = (body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", "x-ratelimit-remaining": "50", "x-ratelimit-reset": "9999999999", ...headers } });

function client(fetchImpl: typeof fetch, token?: string) {
  return new GitHubClient({ token, store: new MemoryCacheStore(), fetchImpl, ttlSeconds: 60 });
}

describe("GitHubClient", () => {
  it("caches responses and never calls twice within the TTL", async () => {
    const fetchImpl = vi.fn(async () => ok({ a: 1 }));
    const c = client(fetchImpl as unknown as typeof fetch);
    await c.request("/repos/a/b");
    const second = await c.request("/repos/a/b");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(second.fromCache).toBe(true);
  });

  it("deduplicates concurrent requests", async () => {
    const fetchImpl = vi.fn(async () => ok({ a: 1 }));
    const c = client(fetchImpl as unknown as typeof fetch);
    await Promise.all([c.request("/x"), c.request("/x"), c.request("/x")]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("sends the token only in the Authorization header", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => { void init; return ok({}); });
    await client(fetchImpl as unknown as typeof fetch, "secret-token").request("/y");
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    expect(String(fetchImpl.mock.calls[0][0])).not.toContain("secret-token");
  });

  it("reports rate limits with the reset time and stops calling GitHub", async () => {
    const reset = Math.floor(Date.now() / 1000) + 600;
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset) } }));
    const c = client(fetchImpl as unknown as typeof fetch);
    await expect(c.request("/a")).rejects.toBeInstanceOf(GitHubRateLimitError);
    await expect(c.request("/b")).rejects.toMatchObject({ resetAt: new Date(reset * 1000) });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps 404 to not found and 5xx to unavailable", async () => {
    const notFound = client((async () => new Response("{}", { status: 404 })) as unknown as typeof fetch);
    await expect(notFound.notFoundGuard("/repos/a/b", "Repository")).rejects.toBeInstanceOf(GitHubNotFoundError);
    const down = client((async () => new Response("oops", { status: 502 })) as unknown as typeof fetch);
    await expect(down.request("/z")).rejects.toBeInstanceOf(GitHubUnavailableError);
  });

  it("serves stale data when GitHub fails after expiry", async () => {
    let now = 1_000_000;
    const store = new MemoryCacheStore();
    let fail = false;
    const fetchImpl = vi.fn(async () => (fail ? new Response("x", { status: 503 }) : ok({ v: 1 })));
    const c = new GitHubClient({ store, fetchImpl: fetchImpl as unknown as typeof fetch, ttlSeconds: 10, now: () => now });
    await c.request("/s");
    now += 60_000;
    fail = true;
    const res = await c.request<{ v: number }>("/s");
    expect(res.data).toEqual({ v: 1 });
    expect(res.stale).toBe(true);
  });

  it("parses Link headers", () => {
    expect(lastPageFromLink('<https://api.github.com/x?per_page=1&page=2>; rel="next", <https://api.github.com/x?per_page=1&page=1234>; rel="last"')).toBe(1234);
    expect(lastPageFromLink(null)).toBeNull();
  });
});

describe("RestGitHubProvider", () => {
  const repoJson = { id: 1, name: "r", owner: { login: "o", type: "User" }, html_url: "https://github.com/o/r", stargazers_count: 10, forks_count: 2, open_issues_count: 1, size: 5, archived: true, private: false, fork: false, default_branch: "main", created_at: "2015-01-01T00:00:00Z", pushed_at: "2018-01-01T00:00:00Z", license: { spdx_id: "MIT", name: "MIT License" }, topics: ["a"] };

  it("normalizes repositories and refuses private ones", async () => {
    const p = new RestGitHubProvider(client((async () => ok(repoJson)) as unknown as typeof fetch));
    expect(await p.getRepository("o", "r")).toMatchObject({ owner: "o", stars: 10, archived: true, license: { spdx: "MIT" }, defaultBranch: "main" });
    const priv = new RestGitHubProvider(client((async () => ok({ ...repoJson, private: true })) as unknown as typeof fetch));
    await expect(priv.getRepository("o", "r")).rejects.toMatchObject({ code: "private_repository" });
  });

  it("aggregates contributor stats into monthly commits and recent activity", async () => {
    const week = (iso: string, c: number) => ({ w: Math.floor(new Date(iso).getTime() / 1000), c, a: 0, d: 0 });
    const body = [{ author: { login: "alice" }, total: 7, weeks: [week("2019-01-06", 3), week("2019-01-13", 4)] }];
    const p = new RestGitHubProvider(client((async () => ok(body)) as unknown as typeof fetch));
    const result = await p.getCommitActivity("o", "r");
    expect(result).toMatchObject({ pending: false, data: { monthly: [{ month: "2019-01", count: 7 }], contributors: [{ login: "alice", total: 7, recent12m: 0 }] } });
  });
});
