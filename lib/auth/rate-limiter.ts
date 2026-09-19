// Rate limiter generico a finestra fissa, in memoria di processo — stesso
// approccio di lib/auth/rate-limit.ts (dedicato al login), ma parametrico e
// senza lockout: qui basta contare le richieste in una finestra temporale,
// non serve un blocco prolungato dopo N fallimenti. Riusato da
// changePassword (lib/actions/account.ts) e dalla generazione PDF
// (app/api/invoices/[id]/pdf/route.ts).
export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

export type RateLimiter = {
  consume(key: string): RateLimitResult;
  reset(key?: string): void;
};

type WindowRecord = {
  count: number;
  windowStart: number;
};

export function createRateLimiter(options: {
  maxRequests: number;
  windowMs: number;
  sweepProbability?: number;
  maxEntries?: number;
}): RateLimiter {
  const {
    maxRequests,
    windowMs,
    sweepProbability = 0.01,
    maxEntries = 5000,
  } = options;
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

      const existingRecord = records.get(key);
      if (existingRecord && !isExpired(existingRecord, now)) {
        if (existingRecord.count >= maxRequests) {
          return {
            allowed: false,
            retryAfterSeconds: Math.max(
              0,
              Math.ceil((existingRecord.windowStart + windowMs - now) / 1000)
            ),
          };
        }

        existingRecord.count += 1;
        return { allowed: true };
      }

      // Se la chiave è nuova e la mappa ha raggiunto la capacità massima,
      // eseguiamo lo sweep delle chiavi scadute e, se ancora piena, eliminiamo
      // la voce più vecchia per evitare memory leak.
      if (!existingRecord && records.size >= maxEntries) {
        sweepExpired(now);
        if (records.size >= maxEntries) {
          const oldestKey = records.keys().next().value;
          if (oldestKey !== undefined) {
            records.delete(oldestKey);
          }
        }
      }

      records.set(key, { count: 1, windowStart: now });
      return { allowed: true };
    },

    reset(key?: string): void {
      if (key !== undefined) {
        records.delete(key);
      } else {
        records.clear();
      }
    },
  };
}
