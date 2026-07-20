// Rate limiter generico a finestra fissa, in memoria di processo — stesso
// approccio di lib/auth/rate-limit.ts (dedicato al login), ma parametrico e
// senza lockout: qui basta contare le richieste in una finestra temporale,
// non serve un blocco prolungato dopo N fallimenti. Riusato da
// changePassword (lib/actions/account.ts) e dalla generazione PDF
// (app/api/invoices/[id]/pdf/route.ts) — vedi SEC-08 in SECURITY_AUDIT.md.
export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

export type RateLimiter = {
  consume(key: string): RateLimitResult;
};

type WindowRecord = {
  count: number;
  windowStart: number;
};

export function createRateLimiter(options: {
  maxRequests: number;
  windowMs: number;
  sweepProbability?: number;
}): RateLimiter {
  const { maxRequests, windowMs, sweepProbability = 0.01 } = options;
  const records = new Map<string, WindowRecord>();

  function isExpired(record: WindowRecord, now: number): boolean {
    return now - record.windowStart >= windowMs;
  }

  function sweepExpired(now: number): void {
    for (const [key, record] of records) {
      if (isExpired(record, now)) {
        records.delete(key);
      }
    }
  }

  return {
    consume(key: string): RateLimitResult {
      const now = Date.now();
      if (Math.random() < sweepProbability) {
        sweepExpired(now);
      }

      const record = records.get(key);
      if (!record || isExpired(record, now)) {
        records.set(key, { count: 1, windowStart: now });
        return { allowed: true };
      }

      if (record.count >= maxRequests) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            0,
            Math.ceil((record.windowStart + windowMs - now) / 1000)
          ),
        };
      }

      record.count += 1;
      return { allowed: true };
    },
  };
}
