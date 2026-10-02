export interface CacheRecord {
  etag: string | null;
  status: number;
  body: unknown;
  fetchedAt: Date;
  expiresAt: Date;
}

export interface CacheStore {
  get(key: string): Promise<CacheRecord | null>;
  set(key: string, record: CacheRecord): Promise<void>;
}

export class MemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, CacheRecord>();

  async get(key: string) {
    return this.map.get(key) ?? null;
  }

  async set(key: string, record: CacheRecord) {
    this.map.set(key, record);
  }
}
