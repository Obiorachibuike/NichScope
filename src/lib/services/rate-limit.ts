/**
 * In-process sliding-window rate limiter.
 *
 * Suitable for a single Node/Vercel instance and for tests. For horizontally
 * scaled deployments this should be backed by a shared store (e.g. Postgres or
 * the platform's own limiter); the interface is intentionally narrow so it can
 * be swapped without touching call sites.
 */

interface Bucket {
  hits: number[];
}

type GlobalLimit = typeof globalThis & {
  __nichscopeRateLimits?: Map<string, Bucket>;
};

const store =
  (globalThis as GlobalLimit).__nichscopeRateLimits ??
  ((globalThis as GlobalLimit).__nichscopeRateLimits = new Map<string, Bucket>());

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  options: { windowMs?: number; max?: number; now?: number } = {},
): RateLimitResult {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 60;
  const now = options.now ?? Date.now();
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((timestamp) => now - timestamp < windowMs);

  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0] ?? now;
    store.set(key, bucket);
    return { allowed: false, remaining: 0, resetAt: oldest + windowMs };
  }

  bucket.hits.push(now);
  store.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, max - bucket.hits.length),
    resetAt: now + windowMs,
  };
}

export function resetRateLimits(): void {
  store.clear();
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
