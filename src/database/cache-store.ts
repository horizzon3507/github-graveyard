import type { CacheRecord, CacheStore } from "@/providers/github/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/database/client";

/** Persists GitHub (and registry) responses in Postgres so every instance shares one cache. */
export class PrismaCacheStore implements CacheStore {
  private lastCleanup = 0;

  async get(key: string): Promise<CacheRecord | null> {
    const row = await db.cacheEntry.findUnique({ where: { key } });
    if (!row) return null;
    return { etag: row.etag, status: row.status, body: row.body, fetchedAt: row.fetchedAt, expiresAt: row.expiresAt };
  }

  async set(key: string, record: CacheRecord): Promise<void> {
    const body = record.body === null || record.body === undefined ? Prisma.JsonNull : (record.body as Prisma.InputJsonValue);
    const data = { etag: record.etag, status: record.status, body, fetchedAt: record.fetchedAt, expiresAt: record.expiresAt };
    await db.cacheEntry.upsert({ where: { key }, create: { key, ...data }, update: data });
    void this.cleanup();
  }

  /** Entries are kept for 7 days past expiry so they can serve as stale fallbacks during rate limits. */
  private async cleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < 3600_000) return;
    this.lastCleanup = now;
    await db.cacheEntry.deleteMany({ where: { expiresAt: { lt: new Date(now - 7 * 86_400_000) } } }).catch(() => undefined);
  }
}
