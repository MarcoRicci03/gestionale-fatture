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

// Chiave composita username+IP: con la sola username, un attaccante potrebbe
// bloccare per LOCKOUT_MS l'accesso di un utente legittimo semplicemente
// fallendo il login MAX_ATTEMPTS volte con quel dato username da un IP
// qualsiasi. Con l'IP nella chiave, il lockout resta isolato alla coppia
// (username, IP) dell'attaccante: l'utente legittimo, connesso da un IP
// diverso, ha un contatore separato e non viene bloccato.
function buildKey(username: string, ip: string): string {
  return `${username.trim().toLowerCase()}::${ip}`;
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

export function checkLoginRateLimit(
  username: string,
  ip: string
): {
  allowed: boolean;
  retryAfterMinutes?: number;
} {
  const now = Date.now();
  if (Math.random() < SWEEP_PROBABILITY) {
    sweepExpired(now);
  }

  const key = buildKey(username, ip);
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

export function recordFailedLogin(username: string, ip: string): void {
  const now = Date.now();
  const key = buildKey(username, ip);
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

  attempts.set(key, {
    count,
    windowStart: record.windowStart,
    lockedUntil: null,
  });
}

export function recordSuccessfulLogin(username: string, ip: string): void {
  attempts.delete(buildKey(username, ip));
}
