import type { CacheStore } from "@/providers/github/cache";
import type { LatestVersion } from "@/analysis/dependencies";

export interface RegistryProvider {
  npmLatest(name: string): Promise<LatestVersion | null>;
  pypiLatest(name: string): Promise<LatestVersion | null>;
  npmDownloadsLastMonth(name: string): Promise<number | null>;
}

const DAY = 86_400_000;

/** Reads public package metadata from npm and PyPI, caching the small projected result. */
export class PublicRegistryProvider implements RegistryProvider {
  constructor(
    private readonly store: CacheStore,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async cached<T>(key: string, url: string, ttlDays: number, project: (json: any) => T | null): Promise<T | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const hit = await this.store.get(key);
    if (hit && hit.expiresAt.getTime() > Date.now()) return hit.status === 200 ? (hit.body as T) : null;
    try {
      const res = await this.fetchImpl(url, { headers: { "User-Agent": "github-graveyard", Accept: "application/json" }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
      if (res.status === 404) {
        await this.store.set(key, { etag: null, status: 404, body: null, fetchedAt: new Date(), expiresAt: new Date(Date.now() + ttlDays * DAY) });
        return null;
      }
      if (!res.ok) return hit?.status === 200 ? (hit.body as T) : null;
      const value = project(await res.json());
      await this.store.set(key, { etag: null, status: value === null ? 404 : 200, body: value, fetchedAt: new Date(), expiresAt: new Date(Date.now() + ttlDays * DAY) });
      return value;
    } catch {
      return hit?.status === 200 ? (hit.body as T) : null;
    }
  }

  npmLatest(name: string) {
    return this.cached<LatestVersion>(`npm:${name}`, `https://registry.npmjs.org/${name.replace("/", "%2F")}/latest`, 3, (j) =>
      j?.version ? { version: String(j.version), deprecated: typeof j.deprecated === "string" ? j.deprecated : null } : null,
    );
  }

  pypiLatest(name: string) {
    return this.cached<LatestVersion>(`pypi:${name}`, `https://pypi.org/pypi/${encodeURIComponent(name)}/json`, 3, (j) =>
      j?.info?.version ? { version: String(j.info.version), deprecated: (j.info.classifiers ?? []).includes("Development Status :: 7 - Inactive") ? "Marked inactive on PyPI" : null } : null,
    );
  }

  npmDownloadsLastMonth(name: string) {
    return this.cached<number>(`npm-dl:${name}`, `https://api.npmjs.org/downloads/point/last-month/${name.replace("/", "%2F")}`, 3, (j) =>
      typeof j?.downloads === "number" ? j.downloads : null,
    );
  }
}
