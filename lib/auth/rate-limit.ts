const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const SWEEP_PROBABILITY = 0.01;

type AttemptRecord = {
  count: number;
  windowStart: number;
  lockedUntil: number | null;
};

const attempts = new Map<string, AttemptRecord>();

function normalizeKey(username: string): string {
  return username.trim().toLowerCase();
}

function isExpired(record: AttemptRecord, now: number): boolean {
  if (record.lockedUntil !== null) {
    return now >= record.lockedUntil;
  }
  return now - record.windowStart >= WINDOW_MS;
}

function sweepExpired(now: number): void {
  for (const [key, record] of attempts) {
    if (isExpired(record, now)) {
      attempts.delete(key);
    }
  }
}

export function checkLoginRateLimit(username: string): {
  allowed: boolean;
  retryAfterMinutes?: number;
} {
  const now = Date.now();
  if (Math.random() < SWEEP_PROBABILITY) {
    sweepExpired(now);
  }

  const key = normalizeKey(username);
  const record = attempts.get(key);
  if (!record) {
    return { allowed: true };
  }

  if (isExpired(record, now)) {
    attempts.delete(key);
    return { allowed: true };
  }

  if (record.lockedUntil !== null) {
    return {
      allowed: false,
      retryAfterMinutes: Math.ceil((record.lockedUntil - now) / 60000),
    };
  }

  return { allowed: true };
}

export function recordFailedLogin(username: string): void {
  const now = Date.now();
  const key = normalizeKey(username);
  const record = attempts.get(key);

  if (!record || isExpired(record, now)) {
    attempts.set(key, { count: 1, windowStart: now, lockedUntil: null });
    return;
  }

  const count = record.count + 1;
  if (count >= MAX_ATTEMPTS) {
    attempts.set(key, {
      count,
      windowStart: record.windowStart,
      lockedUntil: now + LOCKOUT_MS,
    });
    return;
  }

  attempts.set(key, { count, windowStart: record.windowStart, lockedUntil: null });
}

export function recordSuccessfulLogin(username: string): void {
  attempts.delete(normalizeKey(username));
}
