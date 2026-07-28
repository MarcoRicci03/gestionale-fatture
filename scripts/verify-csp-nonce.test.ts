import { it, expect, beforeAll } from "vitest";
import type { NextRequest } from "next/server";

// SEC-08: proxy.ts genera un nonce per-richiesta e lo usa nella CSP su
// script-src (con 'strict-dynamic', senza 'unsafe-inline'), solo in
// produzione — vedi PIANO_FIX_CSP_NONCE.md. Stesso pattern di
// verify-proxy-head-method.test.ts: si costruisce una NextRequest reale e si
// chiama proxy() direttamente, senza un server Next.js in esecuzione.
//
// NODE_ENV va mutato PRIMA di ogni chiamata a proxy() (non al momento
// dell'import): a differenza di next.config.ts, la CSP di proxy.ts è
// costruita dentro la funzione ad ogni invocazione, quindi non serve
// vi.resetModules() per testare dev/produzione nello stesso file.
type MutableProcessEnv = { NODE_ENV: string };
const mutableEnv = process.env as unknown as MutableProcessEnv;

let proxy: typeof import("../proxy").proxy;
let NextRequestCtor: typeof NextRequest;

beforeAll(async () => {
  process.env.JWT_SECRET ??= "verify-script-test-secret-please-ignore-0000000000";
  ({ proxy } = await import("../proxy"));
  ({ NextRequest: NextRequestCtor } = await import("next/server"));
});

function makeRequest(pathname: string, method = "GET"): NextRequest {
  return new NextRequestCtor(`http://localhost${pathname}`, { method });
}

async function withNodeEnv<T>(nodeEnv: string, fn: () => Promise<T>): Promise<T> {
  const previous = mutableEnv.NODE_ENV;
  mutableEnv.NODE_ENV = nodeEnv;
  try {
    return await fn();
  } finally {
    mutableEnv.NODE_ENV = previous;
  }
}

it("in produzione, due richieste sulla stessa route ricevono nonce diversi", async () => {
  await withNodeEnv("production", async () => {
    const csp1 = (await proxy(makeRequest("/login"))).headers.get("content-security-policy");
    const csp2 = (await proxy(makeRequest("/login"))).headers.get("content-security-policy");

    expect(csp1).toBeTruthy();
    expect(csp2).toBeTruthy();
    expect(csp1).not.toBe(csp2);
  });
});

it("in produzione, script-src usa nonce+strict-dynamic e non contiene unsafe-inline", async () => {
  await withNodeEnv("production", async () => {
    const response = await proxy(makeRequest("/login"));
    const csp = response.headers.get("content-security-policy");

    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
});

it("in produzione, style-src resta invariato con unsafe-inline", async () => {
  await withNodeEnv("production", async () => {
    const response = await proxy(makeRequest("/login"));
    const csp = response.headers.get("content-security-policy");

    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });
});

it("in sviluppo non imposta nessuna CSP (comportamento dev invariato)", async () => {
  await withNodeEnv("development", async () => {
    const response = await proxy(makeRequest("/dashboard"));

    expect(response.headers.get("content-security-policy")).toBeNull();
  });
});

it("una richiesta non autenticata su /login riceve la CSP ma non viene reindirizzata", async () => {
  await withNodeEnv("production", async () => {
    const response = await proxy(makeRequest("/login"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });
});

it("una richiesta non autenticata su una pagina protetta viene ancora reindirizzata a /login (baseline invariata)", async () => {
  await withNodeEnv("production", async () => {
    const response = await proxy(makeRequest("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });
});
