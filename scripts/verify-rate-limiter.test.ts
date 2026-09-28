import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createRateLimiter } from "../lib/auth/rate-limiter";

// changePassword (lib/actions/account.ts),
// resetUserPassword (lib/actions/users.ts) e la generazione PDF
// (app/api/invoices/[id]/pdf/route.ts) devono avere un limite di richieste,
// altrimenti chi ottiene una sessione può forzare in loop la password
// attuale, resettare in massa le password di altri utenti, o saturare la
// CPU generando PDF senza sosta.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("createRateLimiter", () => {
  it("consente fino a maxRequests nella finestra, poi blocca", () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60 });

    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(true);

    const fourth = limiter.consume("a");
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBeDefined();

    expect(limiter.consume("b").allowed).toBe(true);
  });

  it("torna consentito dopo la scadenza della finestra", async () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60 });
    limiter.consume("a");
    limiter.consume("a");
    limiter.consume("a");
    expect(limiter.consume("a").allowed).toBe(false);

    await sleep(70);
    expect(limiter.consume("a").allowed).toBe(true);
  });

  it("resetta il conteggio per una chiave specifica o per tutte le chiavi", () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60000 });
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("a").allowed).toBe(false);
    expect(limiter.consume("b").allowed).toBe(true);
    expect(limiter.consume("b").allowed).toBe(false);

    limiter.reset("a");
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("b").allowed).toBe(false);

    limiter.reset();
    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("b").allowed).toBe(true);
  });

  // SEC-04 impone un tetto alla mappa. CR-06: il tetto non deve mai costare un
  // blocco. A mappa piena si espelle la voce più vecchia NON bloccata; se sono
  // tutte bloccate, la chiave nuova viene rifiutata.
  it("rispetta maxEntries espellendo la chiave più vecchia non bloccata (SEC-04, CR-06)", () => {
    const limiter = createRateLimiter({
      maxRequests: 2,
      windowMs: 60000,
      maxEntries: 3,
    });

    expect(limiter.consume("key1").allowed).toBe(true);
    expect(limiter.consume("key2").allowed).toBe(true);
    expect(limiter.consume("key3").allowed).toBe(true);

    // key1 raggiunge il limite ed è bloccata
    expect(limiter.consume("key1").allowed).toBe(true);
    expect(limiter.consume("key1").allowed).toBe(false);

    // key4 fa espellere key2 (la più vecchia non bloccata), non key1
    expect(limiter.consume("key4").allowed).toBe(true);
    expect(limiter.consume("key1").allowed).toBe(false);

    // key2 era stata espulsa: riparte da zero
    expect(limiter.consume("key2").allowed).toBe(true);
  });

  it("con tutte le chiavi bloccate rifiuta le chiavi nuove senza toccare quelle esistenti (CR-06)", () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowMs: 60000,
      maxEntries: 2,
    });

    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("b").allowed).toBe(true);
    // maxRequests 1: a e b sono già al limite

    const nuova = limiter.consume("c");
    expect(nuova.allowed).toBe(false);
    expect(nuova.retryAfterSeconds).toBeGreaterThan(0);

    // i blocchi restano, e c non è stata inserita
    expect(limiter.consume("a").allowed).toBe(false);
    expect(limiter.consume("b").allowed).toBe(false);
    expect(limiter.consume("c").allowed).toBe(false);
  });

  it("un attaccante con molte chiavi nuove non azzera il blocco di un'altra chiave (CR-06)", () => {
    const limiter = createRateLimiter({
      maxRequests: 2,
      windowMs: 60000,
      maxEntries: 100,
    });

    limiter.consume("vittima");
    limiter.consume("vittima");
    expect(limiter.consume("vittima").allowed).toBe(false);

    for (let i = 0; i < 1000; i++) {
      limiter.consume(`spray_${i}`);
    }

    expect(limiter.consume("vittima").allowed).toBe(false);
  });

  it("dopo la scadenza delle finestre torna posto per chiavi nuove (CR-06)", async () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowMs: 60,
      maxEntries: 1,
    });

    expect(limiter.consume("a").allowed).toBe(true);
    expect(limiter.consume("b").allowed).toBe(false);

    await sleep(70);
    expect(limiter.consume("b").allowed).toBe(true);
  });
});

describe("rate limiter usato dalle rotte sensibili", () => {
  it("changePassword consuma un rate limiter prima di verificare la password attuale", () => {
    const source = readFileSync(
      join(__dirname, "..", "lib", "actions", "account.ts"),
      "utf-8"
    );
    expect(source.includes("createRateLimiter")).toBe(true);
    expect(/changePasswordLimiter\.consume/.test(source)).toBe(true);
  });

  it("resetUserPassword consuma un rate limiter prima di resettare la password", () => {
    const source = readFileSync(
      join(__dirname, "..", "lib", "actions", "users.ts"),
      "utf-8"
    );
    expect(source.includes("createRateLimiter")).toBe(true);
    expect(/resetPasswordLimiter\.consume/.test(source)).toBe(true);
  });

  it("la route di generazione PDF consuma un rate limiter prima di generare il PDF", () => {
    const source = readFileSync(
      join(__dirname, "..", "app", "api", "invoices", "[id]", "pdf", "route.ts"),
      "utf-8"
    );
    expect(source.includes("createRateLimiter")).toBe(true);
    expect(/pdfGenerationLimiter\.consume/.test(source)).toBe(true);
  });

  it("le chiamate telematiche Sistema TS consumano rate limiter dedicati", () => {
    const source = readFileSync(
      join(__dirname, "..", "lib", "actions", "sistema-ts.ts"),
      "utf-8"
    );
    expect(source.includes("sistemaTsTransmissionLimiter")).toBe(true);
    expect(source.includes("sistemaTsSyncLimiter")).toBe(true);
    expect(/sistemaTsTransmissionLimiter\.consume/.test(source)).toBe(true);
    expect(/sistemaTsSyncLimiter\.consume/.test(source)).toBe(true);
  });

  it("il modulo dei rate limiter Sistema TS non è marcato 'use server'", () => {
    const source = readFileSync(
      join(__dirname, "..", "lib", "sistemats", "rate-limiters.ts"),
      "utf-8"
    );
    expect(source.includes('"use server"')).toBe(false);
    expect(source.includes("'use server'")).toBe(false);
    expect(source.includes("createRateLimiter")).toBe(true);
  });
});
