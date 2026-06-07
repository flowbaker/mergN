export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  take(key: string, rule: RateLimitRule, cost?: number): Promise<RateLimitResult>;
}

interface Bucket {
  tokens: number;
  last: number;
}

export function createMemoryRateLimiter(opts?: {
  sweepMs?: number;
}): RateLimiter {
  const buckets = new Map<string, Bucket>();
  const sweepMs = opts?.sweepMs ?? 5 * 60_000;

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      if (now - b.last > sweepMs) buckets.delete(key);
    }
  }, sweepMs);
  if (typeof timer.unref === "function") timer.unref();

  return {
    async take(key, rule, cost = 1) {
      const now = Date.now();
      const ratePerMs = rule.limit / rule.windowMs;
      const b = buckets.get(key) ?? { tokens: rule.limit, last: now };
      b.tokens = Math.min(rule.limit, b.tokens + (now - b.last) * ratePerMs);
      b.last = now;
      buckets.set(key, b);

      if (b.tokens >= cost) {
        b.tokens -= cost;
        return { ok: true, remaining: Math.floor(b.tokens), retryAfterMs: 0 };
      }
      return {
        ok: false,
        remaining: Math.floor(b.tokens),
        retryAfterMs: Math.ceil((cost - b.tokens) / ratePerMs),
      };
    },
  };
}
