const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

// SEC-04 in SECURITY_AUDIT.md: le Map vivono in memoria di processo (si
// azzerano a ogni riavvio, non condivise tra repliche — accettato per ora,
// l'app resta a singola istanza). Senza un tetto, un attaccante che manda
// username/IP diversi a ogni tentativo (vedi SEC-01: con TRUSTED_PROXY=false
// l'IP collassa sempre su "unknown", ma lo username resta arbitrario e non
// validato finché la query su Postgres non lo risolve) fa crescere le Map
// senza limite. MAX_ENTRIES_PER_MAP impone un tetto fisso con eviction LRU
// (per ordine di scrittura, non di lettura: ogni tentativo fallito scrive
// comunque via recordFailedLogin, quindi l'ordine di scrittura riflette già
// l'attività reale). Sostituisce lo sweep probabilistico (SWEEP_PROBABILITY,
// che con traffico basso lasciava voci scadute in memoria a lungo) con uno
// sweep temporizzato indipendente dal traffico in ingresso.
export const MAX_ENTRIES_PER_MAP = 10_000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

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

// Scrive spostando la chiave in coda all'ordine di iterazione della Map (un
// Map.set su una chiave già esistente NON la sposta in coda da solo):
// necessario perché evictOldest() tratta la prima chiave in ordine di
// iterazione come la meno recentemente scritta.
function writeRecord(
  map: Map<string, AttemptRecord>,
  key: string,
  record: AttemptRecord
): void {
  map.delete(key);
  map.set(key, record);
}

function evictOldest(map: Map<string, AttemptRecord>): void {
  while (map.size > MAX_ENTRIES_PER_MAP) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) break;
    map.delete(oldestKey);
  }
}

// Esportata per scripts/verify-rate-limit-bounds.ts: la logica di scadenza è
// pura (dipende solo da `now`, non dall'orologio reale), verificabile senza
// dover aspettare WINDOW_MS/LOCKOUT_MS per davvero. L'unico pezzo non
// testato direttamente è il setInterval che la richiama periodicamente più
// sotto in questo file — puro glue code, non porta logica propria.
export function sweepExpired(now: number): void {
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

// Guardia contro l'hot-reload di Next in sviluppo (stesso pattern di
// lib/prisma.ts): senza, ogni ricompilazione di questo modulo aggiungerebbe
// un nuovo setInterval, accumulando timer via via che si modifica il codice.
// .unref() evita che il timer da solo tenga vivo il processo (rilevante per
// gli script scripts/verify-*.ts, che importano questo modulo e devono poter
// terminare da soli).
const globalForRateLimit = globalThis as unknown as {
  loginRateLimitSweepInterval: NodeJS.Timeout | undefined;
};

if (!globalForRateLimit.loginRateLimitSweepInterval) {
  const interval = setInterval(() => {
    sweepExpired(Date.now());
  }, SWEEP_INTERVAL_MS);
  interval.unref();
  globalForRateLimit.loginRateLimitSweepInterval = interval;
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
    writeRecord(map, key, { count: 1, windowStart: now, lockedUntil: null });
    evictOldest(map);
    return;
  }

  const count = record.count + 1;
  if (count >= maxAttempts) {
    writeRecord(map, key, {
      count,
      windowStart: record.windowStart,
      lockedUntil: now + LOCKOUT_MS,
    });
    evictOldest(map);
    return;
  }

  writeRecord(map, key, {
    count,
    windowStart: record.windowStart,
    lockedUntil: null,
  });
  evictOldest(map);
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
