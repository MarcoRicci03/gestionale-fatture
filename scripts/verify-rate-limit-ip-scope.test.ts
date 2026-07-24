import { describe, it, expect } from "vitest";
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

it("isola il lockout per coppia (username, ip)", () => {
  const username = "verify-rate-limit-user";
  const ipAttacker = "203.0.113.10";
  const ipVictim = "203.0.113.20";

  for (let i = 0; i < 5; i++) {
    recordFailedLogin(username, ipAttacker);
  }

  expect(
    checkLoginRateLimit(username, ipAttacker).allowed,
    "l'IP dell'attaccante deve risultare bloccato dopo 5 fallimenti"
  ).toBe(false);

  expect(
    checkLoginRateLimit(username, ipVictim).allowed,
    "un IP diverso con lo stesso username NON deve essere bloccato dai fallimenti dell'attaccante"
  ).toBe(true);

  recordFailedLogin(username, ipVictim);
  recordSuccessfulLogin(username, ipVictim);
  expect(
    checkLoginRateLimit(username, ipVictim).allowed,
    "un login riuscito deve sbloccare la coppia (username, ip) del richiedente"
  ).toBe(true);

  expect(
    checkLoginRateLimit(username, ipAttacker).allowed,
    "il login riuscito della vittima non deve sbloccare l'IP dell'attaccante per lo stesso username"
  ).toBe(false);
});

it("il contatore per sola username blocca dopo USERNAME_MAX_ATTEMPTS anche ruotando l'IP", () => {
  // Senza un proxy fidato, ruotare X-Forwarded-For a ogni
  // tentativo genera una chiave (username, ip) diversa ogni volta e
  // aggirerebbe il lockout per IP sopra. Il contatore per sola username deve
  // bloccare comunque l'attaccante dopo USERNAME_MAX_ATTEMPTS tentativi
  // complessivi.
  const username = "verify-rate-limit-user-2";

  // 19 fallimenti, ognuno da un IP diverso: nessuna coppia (username, ip)
  // raggiunge mai MAX_ATTEMPTS, ma il contatore per sola username sì.
  for (let i = 0; i < 19; i++) {
    recordFailedLogin(username, `203.0.113.${i}`);
  }

  expect(
    checkLoginRateLimit(username, "203.0.113.200").allowed,
    "prima di USERNAME_MAX_ATTEMPTS fallimenti totali, un IP mai usato deve restare consentito"
  ).toBe(true);

  recordFailedLogin(username, "203.0.113.201");

  expect(
    checkLoginRateLimit(username, "203.0.113.202").allowed,
    "dopo USERNAME_MAX_ATTEMPTS fallimenti totali (anche da IP tutti diversi), lo username deve risultare bloccato indipendentemente dall'IP dichiarato"
  ).toBe(false);
});

describe("resolveClientIp", () => {
  it("senza proxy fidato non legge X-Forwarded-For", () => {
    // Senza TRUSTED_PROXY=true, X-Forwarded-For/X-Real-IP
    // non vanno letti (sono falsificabili dal client), altrimenti il rate
    // limiter userebbe una chiave (username, ip) che l'attaccante controlla.
    const headersWithForwardedFor = {
      get: (name: string) =>
        name === "x-forwarded-for" ? "198.51.100.5" : null,
    };

    expect(resolveClientIp(headersWithForwardedFor, false)).toBe("unknown");
    expect(resolveClientIp(headersWithForwardedFor, true)).toBe("198.51.100.5");
  });
});

describe("parseClientIpFromHeaders", () => {
  it("usa il primo IP della catena X-Forwarded-For", () => {
    const headersWithForwardedChain = {
      get: (name: string) =>
        name === "x-forwarded-for" ? "198.51.100.5, 10.0.0.1" : null,
    };
    expect(parseClientIpFromHeaders(headersWithForwardedChain)).toBe("198.51.100.5");
  });

  it("usa X-Real-IP quando X-Forwarded-For è assente", () => {
    const headersWithRealIpOnly = {
      get: (name: string) => (name === "x-real-ip" ? "198.51.100.9" : null),
    };
    expect(parseClientIpFromHeaders(headersWithRealIpOnly)).toBe("198.51.100.9");
  });

  it("ricade su 'unknown' quando nessun header IP è presente", () => {
    const headersEmpty = { get: () => null };
    expect(parseClientIpFromHeaders(headersEmpty)).toBe("unknown");
  });
});
