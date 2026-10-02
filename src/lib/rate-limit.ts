import { AppError } from "@/lib/errors";

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Sliding-window limiter kept in process memory. Good for a single instance;
 * swap `check` for a Redis/Postgres backed implementation when scaling out.
 */
export function check(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, b] of buckets) {
      if (b.hits.length === 0 || now - b.hits[b.hits.length - 1] > 10 * 60_000) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((windowMs - (now - bucket.hits[0])) / 1000) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "local";
}

export function enforceRateLimit(request: Request, scope: string, limit: number, windowMs = 60_000): RateLimitResult {
  const result = check(`${scope}:${clientIp(request.headers)}`, limit, windowMs);
  if (!result.allowed) {
    throw new AppError("too_many_requests", `Too many requests. Try again in ${result.retryAfterSeconds}s.`, {
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
  return result;
}

export function resetRateLimits() {
  buckets.clear();
}
