import {
  checkLoginRateLimit,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "../lib/auth/rate-limit";
import {
  parseClientIpFromHeaders,
  resolveClientIp,
} from "../lib/auth/client-ip";

// Regressione: il rate limiter di login deve isolare i tentativi falliti per
// coppia (username, IP), non solo per username — altrimenti un attaccante
// che conosce uno username può bloccare per 15 minuti l'accesso legittimo
// semplicemente fallendo 5 volte da un IP qualsiasi (vedi ROADMAP_FIX.md).
const failures: string[] = [];

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    failures.push(
      `${message} — atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`
    );
  }
}

function testIpScopedLockout(): void {
  const username = "verify-rate-limit-user";
  const ipAttacker = "203.0.113.10";
  const ipVictim = "203.0.113.20";

  for (let i = 0; i < 5; i++) {
    recordFailedLogin(username, ipAttacker);
  }

  const attackerResult = checkLoginRateLimit(username, ipAttacker);
  assertEqual(
    attackerResult.allowed,
    false,
    "l'IP dell'attaccante deve risultare bloccato dopo 5 fallimenti"
  );

  const victimResult = checkLoginRateLimit(username, ipVictim);
  assertEqual(
    victimResult.allowed,
    true,
    "un IP diverso con lo stesso username NON deve essere bloccato dai fallimenti dell'attaccante"
  );

  recordFailedLogin(username, ipVictim);
  recordSuccessfulLogin(username, ipVictim);
  const victimAfterSuccess = checkLoginRateLimit(username, ipVictim);
  assertEqual(
    victimAfterSuccess.allowed,
    true,
    "un login riuscito deve sbloccare la coppia (username, ip) del richiedente"
  );

  const attackerStillLocked = checkLoginRateLimit(username, ipAttacker);
  assertEqual(
    attackerStillLocked.allowed,
    false,
    "il login riuscito della vittima non deve sbloccare l'IP dell'attaccante per lo stesso username"
  );
}

// Regressione SEC-01: senza un proxy fidato, ruotare X-Forwarded-For a ogni
// tentativo genera una chiave (username, ip) diversa ogni volta e aggirerebbe
// il lockout per IP sopra. Il contatore per sola username deve bloccare
// comunque l'attaccante dopo USERNAME_MAX_ATTEMPTS tentativi complessivi.
function testUsernameWideLockoutSurvivesIpRotation(): void {
  const username = "verify-rate-limit-user-2";

  // 19 fallimenti, ognuno da un IP diverso: nessuna coppia (username, ip)
  // raggiunge mai MAX_ATTEMPTS, ma il contatore per sola username sì.
  for (let i = 0; i < 19; i++) {
    recordFailedLogin(username, `203.0.113.${i}`);
  }

  const stillAllowedFromFreshIp = checkLoginRateLimit(username, "203.0.113.200");
  assertEqual(
    stillAllowedFromFreshIp.allowed,
    true,
    "prima di USERNAME_MAX_ATTEMPTS fallimenti totali, un IP mai usato deve restare consentito"
  );

  recordFailedLogin(username, "203.0.113.201");

  const blockedFromFreshIp = checkLoginRateLimit(username, "203.0.113.202");
  assertEqual(
    blockedFromFreshIp.allowed,
    false,
    "dopo USERNAME_MAX_ATTEMPTS fallimenti totali (anche da IP tutti diversi), lo username deve risultare bloccato indipendentemente dall'IP dichiarato"
  );
}

// Regressione SEC-01: senza TRUSTED_PROXY=true, X-Forwarded-For/X-Real-IP non
// vanno letti (sono falsificabili dal client), altrimenti il rate limiter
// userebbe una chiave (username, ip) che l'attaccante controlla.
function testResolveClientIpTrustGating(): void {
  const headersWithForwardedFor = {
    get: (name: string) =>
      name === "x-forwarded-for" ? "198.51.100.5" : null,
  };

  assertEqual(
    resolveClientIp(headersWithForwardedFor, false),
    "unknown",
    "senza proxy fidato, X-Forwarded-For non deve essere letto (bucket 'unknown')"
  );

  assertEqual(
    resolveClientIp(headersWithForwardedFor, true),
    "198.51.100.5",
    "con proxy fidato, X-Forwarded-For deve essere letto normalmente"
  );
}

function testParseClientIpFromHeaders(): void {
  const headersWithForwardedChain = {
    get: (name: string) =>
      name === "x-forwarded-for" ? "198.51.100.5, 10.0.0.1" : null,
  };
  assertEqual(
    parseClientIpFromHeaders(headersWithForwardedChain),
    "198.51.100.5",
    "deve usare il primo IP della catena X-Forwarded-For"
  );

  const headersWithRealIpOnly = {
    get: (name: string) => (name === "x-real-ip" ? "198.51.100.9" : null),
  };
  assertEqual(
    parseClientIpFromHeaders(headersWithRealIpOnly),
    "198.51.100.9",
    "deve usare X-Real-IP quando X-Forwarded-For è assente"
  );

  const headersEmpty = { get: () => null };
  assertEqual(
    parseClientIpFromHeaders(headersEmpty),
    "unknown",
    "deve ricadere su 'unknown' quando nessun header IP è presente"
  );
}

testIpScopedLockout();
testUsernameWideLockoutSurvivesIpRotation();
testResolveClientIpTrustGating();
testParseClientIpFromHeaders();

if (failures.length > 0) {
  console.error("verify-rate-limit-ip-scope: FALLITO");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  "Rate limiter isolato correttamente per (username, IP); parsing IP corretto."
);
