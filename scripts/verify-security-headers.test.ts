import { describe, it, expect, vi } from "vitest";

// next.config.ts non impostava alcun header di
// sicurezza HTTP (CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
// Referrer-Policy, Permissions-Policy). Questo test chiama direttamente
// `headers()` dalla config esportata (senza bisogno di un server Next.js
// realmente in ascolto) e verifica che gli header attesi siano presenti con i
// valori corretti, sia in sviluppo sia in produzione.

// @types/node dichiara NODE_ENV readonly per scoraggiarne la mutazione a
// runtime nel codice applicativo: qui serve invece deliberatamente, per
// testare che next.config.ts emetta header diversi in dev/produzione senza
// dover far ripartire il processo con un NODE_ENV diverso ogni volta.
type MutableProcessEnv = { NODE_ENV: string };
const mutableEnv = process.env as unknown as MutableProcessEnv;

type HeaderEntry = { key: string; value: string };
type HeaderRule = { source: string; headers: HeaderEntry[] };

function findHeaderValue(rules: HeaderRule[], key: string): string | undefined {
  for (const rule of rules) {
    const match = rule.headers.find((h) => h.key === key);
    if (match) return match.value;
  }
  return undefined;
}

async function loadHeadersFor(nodeEnv: string): Promise<HeaderRule[]> {
  const previousNodeEnv = mutableEnv.NODE_ENV;
  mutableEnv.NODE_ENV = nodeEnv;
  try {
    // Import dinamico DOPO aver impostato NODE_ENV: il modulo legge
    // process.env.NODE_ENV una sola volta, al caricamento — serve un import
    // fresco per ogni valore testato. vi.resetModules() svuota la cache dei
    // moduli di Vitest (un query param non statico non è supportato
    // dall'analisi degli import dinamici di Vite, a differenza di tsx/Node).
    vi.resetModules();
    const mod = await import("../next.config");
    const config = mod.default;
    // next.config.ts definisce sempre `headers()`: NextConfig lo tipizza
    // opzionale perché nel caso generale non è obbligatorio.
    return (await config.headers!()) as HeaderRule[];
  } finally {
    mutableEnv.NODE_ENV = previousNodeEnv;
  }
}

describe.each(["development", "production"])("header sempre presenti [%s]", (nodeEnv) => {
  it("X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy", async () => {
    const rules = await loadHeadersFor(nodeEnv);

    expect(findHeaderValue(rules, "X-Frame-Options")).toBe("DENY");
    expect(findHeaderValue(rules, "X-Content-Type-Options")).toBe("nosniff");
    expect(findHeaderValue(rules, "Referrer-Policy")).toBeTruthy();
    expect(findHeaderValue(rules, "Permissions-Policy")).toBeTruthy();
  });
});

describe("header solo di produzione", () => {
  it("in sviluppo CSP/HSTS non sono impostati (romperebbero Turbopack HMR)", async () => {
    const devRules = await loadHeadersFor("development");
    expect(findHeaderValue(devRules, "Content-Security-Policy")).toBeUndefined();
    expect(findHeaderValue(devRules, "Strict-Transport-Security")).toBeUndefined();
  });

  it("in produzione la CSP include le direttive attese", async () => {
    const prodRules = await loadHeadersFor("production");
    const csp = findHeaderValue(prodRules, "Content-Security-Policy");
    expect(csp).toBeTruthy();
    for (const expectedDirective of [
      "default-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ]) {
      expect(csp).toContain(expectedDirective);
    }
  });

  it("in produzione Strict-Transport-Security è impostato con max-age", async () => {
    const prodRules = await loadHeadersFor("production");
    const hsts = findHeaderValue(prodRules, "Strict-Transport-Security");
    expect(hsts).toContain("max-age=");
  });
});

describe("poweredByHeader", () => {
  it("è disattivato: Next.js non deve aggiungere X-Powered-By: Next.js (SEC-07)", async () => {
    vi.resetModules();
    const mod = await import("../next.config");
    expect(mod.default.poweredByHeader).toBe(false);
  });
});
