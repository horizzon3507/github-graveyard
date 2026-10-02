import { AppError, GitHubNotFoundError, GitHubRateLimitError, GitHubUnavailableError } from "@/lib/errors";
import type { CacheRecord, CacheStore } from "@/providers/github/cache";

export interface GitHubClientOptions {
  token?: string;
  store: CacheStore;
  baseUrl?: string;
  ttlSeconds?: number;
  fetchImpl?: typeof fetch;
  userAgent?: string;
  now?: () => number;
}

export interface RequestOptions {
  /** Seconds the response may be served from cache without asking GitHub. */
  ttl?: number;
  /** Accept 202 (stats still computing) instead of retrying. */
  allowAccepted?: boolean;
  headers?: Record<string, string>;
}

export interface GitHubResponse<T> {
  status: number;
  data: T | null;
  link: string | null;
  fromCache: boolean;
  stale: boolean;
}

interface Stored {
  data: unknown;
  link: string | null;
}

interface RateState {
  remaining: number;
  reset: number;
}

const NEGATIVE_TTL = 600;

export class GitHubClient {
  private readonly token?: string;
  private readonly store: CacheStore;
  private readonly baseUrl: string;
  private readonly ttl: number;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;
  private readonly now: () => number;
  private readonly rate = new Map<string, RateState>();
  private readonly inflight = new Map<string, Promise<GitHubResponse<unknown>>>();

  constructor(options: GitHubClientOptions) {
    this.token = options.token;
    this.store = options.store;
    this.baseUrl = options.baseUrl ?? "https://api.github.com";
    this.ttl = options.ttlSeconds ?? 6 * 3600;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.userAgent = options.userAgent ?? "github-graveyard";
    this.now = options.now ?? Date.now;
  }

  get authenticated() {
    return Boolean(this.token);
  }

  rateLimitFor(resource: string): RateState | undefined {
    return this.rate.get(resource);
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<GitHubResponse<T>> {
    const key = `gh:${path}`;
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<GitHubResponse<T>>;
    const promise = this.execute<T>(key, path, options).finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise as Promise<GitHubResponse<unknown>>);
    return promise;
  }

  private resourceOf(path: string) {
    return path.startsWith("/search/") ? "search" : "core";
  }

  private async execute<T>(key: string, path: string, options: RequestOptions): Promise<GitHubResponse<T>> {
    const cached = await this.store.get(key);
    const nowMs = this.now();
    if (cached && cached.expiresAt.getTime() > nowMs) return this.fromRecord<T>(cached, false, true);

    const resource = this.resourceOf(path);
    const state = this.rate.get(resource);
    if (state && state.remaining <= 0 && state.reset * 1000 > nowMs) {
      if (cached && cached.status === 200) return this.fromRecord<T>(cached, true, true);
      throw new GitHubRateLimitError(new Date(state.reset * 1000));
    }

    let response: Response | null = null;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const headers: Record<string, string> = {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": this.userAgent,
          ...options.headers,
        };
        if (this.token) headers.Authorization = `Bearer ${this.token}`;
        if (cached?.etag && cached.status === 200) headers["If-None-Match"] = cached.etag;
        response = await this.fetchImpl(`${this.baseUrl}${path}`, { headers, signal: AbortSignal.timeout(20_000), cache: "no-store" });
        if (response.status < 500) break;
        lastError = new Error(`GitHub responded ${response.status}`);
      } catch (error) {
        lastError = error;
        response = null;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    if (!response || response.status >= 500) {
      if (cached && cached.status === 200) return this.fromRecord<T>(cached, true, true);
      throw new GitHubUnavailableError(lastError instanceof Error && response === null ? "Could not reach the GitHub API." : "GitHub API is unavailable right now.");
    }

    const remaining = response.headers.get("x-ratelimit-remaining");
    const reset = response.headers.get("x-ratelimit-reset");
    if (remaining !== null && reset !== null) {
      this.rate.set(response.headers.get("x-ratelimit-resource") === "search" ? "search" : resource, { remaining: Number(remaining), reset: Number(reset) });
    }

    const ttlMs = (options.ttl ?? this.ttl) * 1000;

    if (response.status === 304 && cached) {
      const refreshed: CacheRecord = { ...cached, fetchedAt: new Date(nowMs), expiresAt: new Date(nowMs + ttlMs) };
      await this.store.set(key, refreshed);
      return this.fromRecord<T>(refreshed, true, false);
    }

    if (response.status === 202) {
      if (options.allowAccepted) return { status: 202, data: null, link: null, fromCache: false, stale: false };
      throw new GitHubUnavailableError("GitHub is still computing this data. Try again shortly.");
    }

    if (response.status === 403 || response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const limited = remaining === "0" || retryAfter !== null || response.status === 429;
      if (limited) {
        const resetAt = retryAfter ? new Date(nowMs + Number(retryAfter) * 1000) : reset ? new Date(Number(reset) * 1000) : null;
        if (resetAt) this.rate.set(resource, { remaining: 0, reset: Math.ceil(resetAt.getTime() / 1000) });
        if (cached && cached.status === 200) return this.fromRecord<T>(cached, true, true);
        throw new GitHubRateLimitError(resetAt);
      }
      throw new AppError("forbidden", "GitHub denied access to this resource.");
    }

    if (response.status === 404 || response.status === 410 || response.status === 451) {
      await this.store.set(key, { etag: null, status: 404, body: null, fetchedAt: new Date(nowMs), expiresAt: new Date(nowMs + NEGATIVE_TTL * 1000) });
      return { status: 404, data: null, link: null, fromCache: false, stale: false };
    }

    if (response.status === 409 || response.status === 422) {
      return { status: response.status, data: null, link: null, fromCache: false, stale: false };
    }

    if (response.status === 204) {
      await this.store.set(key, { etag: null, status: 200, body: { data: null, link: null } satisfies Stored, fetchedAt: new Date(nowMs), expiresAt: new Date(nowMs + ttlMs) });
      return { status: 204, data: null, link: null, fromCache: false, stale: false };
    }

    if (!response.ok) throw new GitHubUnavailableError(`GitHub responded with ${response.status}.`);

    const data = (await response.json()) as unknown;
    const link = response.headers.get("link");
    const record: CacheRecord = {
      etag: response.headers.get("etag"),
      status: 200,
      body: { data, link } satisfies Stored,
      fetchedAt: new Date(nowMs),
      expiresAt: new Date(nowMs + ttlMs),
    };
    await this.store.set(key, record);
    return { status: 200, data: data as T, link, fromCache: false, stale: false };
  }

  private fromRecord<T>(record: CacheRecord, stale: boolean, fromCache: boolean): GitHubResponse<T> {
    if (record.status === 404) return { status: 404, data: null, link: null, fromCache, stale };
    const stored = record.body as Stored;
    return { status: 200, data: stored.data as T, link: stored.link, fromCache, stale };
  }

  /** Fetches text from raw.githubusercontent.com (not counted against API rate limits). */
  async raw(url: string, ttl = 24 * 3600, maxBytes = 200_000): Promise<string | null> {
    const key = `raw:${url}`;
    const cached = await this.store.get(key);
    const nowMs = this.now();
    if (cached && cached.expiresAt.getTime() > nowMs) return cached.status === 200 ? ((cached.body as { text: string }).text ?? null) : null;
    try {
      const response = await this.fetchImpl(url, { headers: { "User-Agent": this.userAgent }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
      if (response.status === 404) {
        await this.store.set(key, { etag: null, status: 404, body: null, fetchedAt: new Date(nowMs), expiresAt: new Date(nowMs + NEGATIVE_TTL * 1000) });
        return null;
      }
      if (!response.ok) return cached && cached.status === 200 ? (cached.body as { text: string }).text : null;
      const text = (await response.text()).slice(0, maxBytes);
      await this.store.set(key, { etag: null, status: 200, body: { text }, fetchedAt: new Date(nowMs), expiresAt: new Date(nowMs + ttl * 1000) });
      return text;
    } catch {
      return cached && cached.status === 200 ? (cached.body as { text: string }).text : null;
    }
  }

  async notFoundGuard<T>(path: string, what: string, options?: RequestOptions): Promise<T> {
    const response = await this.request<T>(path, options);
    if (response.status === 404 || response.data === null) throw new GitHubNotFoundError(what);
    return response.data;
  }
}

export function lastPageFromLink(link: string | null): number | null {
  if (!link) return null;
  const match = link.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return match ? Number(match[1]) : null;
}
