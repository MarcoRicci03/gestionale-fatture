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
});
