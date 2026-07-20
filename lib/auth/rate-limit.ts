const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const SWEEP_PROBABILITY = 0.01;

// Rete di sicurezza indipendente dall'IP: senza TRUSTED_PROXY=true (vedi
// lib/auth/client-ip.ts), o anche con un reverse proxy configurato male, un
// attaccante che falsifica X-Forwarded-For ottiene una chiave (username, ip)
// diversa a ogni tentativo e aggirerebbe il lockout sottostante. Questo
// secondo contatore, chiavato sulla sola username, blocca comunque
// l'attaccante dopo USERNAME_MAX_ATTEMPTS tentativi complessivi, qualunque IP
// dichiari. Soglia più alta di MAX_ATTEMPTS perché aggrega anche i fallimenti
// legittimi di più persone/dispositivi diversi che condividono lo stesso
// username (raro in questo gestionale mono-utente-per-studio, ma non
// impossibile).
const USERNAME_MAX_ATTEMPTS = 20;

type AttemptRecord = {
  count: number;
  windowStart: number;
  lockedUntil: number | null;
};

// Chiave composita username+IP: con la sola username, un attaccante potrebbe
// bloccare per LOCKOUT_MS l'accesso di un utente legittimo semplicemente
// fallendo il login MAX_ATTEMPTS volte con quel dato username da un IP
// qualsiasi. Con l'IP nella chiave, il lockout resta isolato alla coppia
// (username, IP) dell'attaccante: l'utente legittimo, connesso da un IP
// diverso, ha un contatore separato e non viene bloccato.
const attempts = new Map<string, AttemptRecord>();

// Contatore per USERNAME_MAX_ATTEMPTS, indipendente dall'IP dichiarato.
const usernameAttempts = new Map<string, AttemptRecord>();

// Codifica JSON (non concatenazione con separatore) perché username è input
// utente non sanificato (può contenere "::") e gli IPv6 usano nativamente
// "::" come shorthand: una concatenazione con separatore fisso non sarebbe
// un round-trip univoco e potrebbe far collidere coppie (username, ip)
// distinte sulla stessa chiave.
function buildKey(username: string, ip: string): string {
  return JSON.stringify([username.trim().toLowerCase(), ip]);
}

function buildUsernameKey(username: string): string {
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
  for (const [key, record] of usernameAttempts) {
    if (isExpired(record, now)) {
      usernameAttempts.delete(key);
    }
  }
}

function checkRecord(
  map: Map<string, AttemptRecord>,
  key: string,
  now: number
): { allowed: boolean; retryAfterMinutes?: number } {
  const record = map.get(key);
  if (!record) {
    return { allowed: true };
  }

  if (isExpired(record, now)) {
    map.delete(key);
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

  const ipResult = checkRecord(attempts, buildKey(username, ip), now);
  const usernameResult = checkRecord(
    usernameAttempts,
    buildUsernameKey(username),
    now
  );

  if (!ipResult.allowed || !usernameResult.allowed) {
    return {
      allowed: false,
      retryAfterMinutes: Math.max(
        ipResult.retryAfterMinutes ?? 0,
        usernameResult.retryAfterMinutes ?? 0
      ),
    };
  }

  return { allowed: true };
}

function recordFailure(
  map: Map<string, AttemptRecord>,
  key: string,
  now: number,
  maxAttempts: number
): void {
  const record = map.get(key);

  if (!record || isExpired(record, now)) {
    map.set(key, { count: 1, windowStart: now, lockedUntil: null });
    return;
  }

  const count = record.count + 1;
  if (count >= maxAttempts) {
    map.set(key, {
      count,
      windowStart: record.windowStart,
      lockedUntil: now + LOCKOUT_MS,
    });
    return;
  }

  map.set(key, {
    count,
    windowStart: record.windowStart,
    lockedUntil: null,
  });
}

export function recordFailedLogin(username: string, ip: string): void {
  const now = Date.now();
  recordFailure(attempts, buildKey(username, ip), now, MAX_ATTEMPTS);
  recordFailure(
    usernameAttempts,
    buildUsernameKey(username),
    now,
    USERNAME_MAX_ATTEMPTS
  );
}

export function recordSuccessfulLogin(username: string, ip: string): void {
  attempts.delete(buildKey(username, ip));
  usernameAttempts.delete(buildUsernameKey(username));
}
