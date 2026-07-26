import { it, expect, beforeAll } from "vitest";
import type { NextRequest } from "next/server";

// proxy.ts lascia passare le richieste non-GET (Server Actions, che si
// autenticano da sole), ma HEAD è instradata da Next.js sulle stesse route
// delle GET: senza escluderla esplicitamente, una richiesta HEAD su una
// pagina protetta saltava il controllo di sessione (SEC-06). A differenza
// di verify-proxy-matcher.test.ts (che testa il matcher come RegExp
// standard, senza invocare la funzione), qui serve il comportamento vero:
// si chiama proxy() con una NextRequest reale, costruibile senza un server
// Next.js in esecuzione.
//
// JWT_SECRET va impostato PRIMA di importare proxy.ts (che importa
// lib/auth/jwt.ts, che lo legge e valida al caricamento del modulo): stesso
// pattern di verify-jwt-secret-strength.test.ts.

let proxy: typeof import("../proxy").proxy;
let NextRequestCtor: typeof NextRequest;

beforeAll(async () => {
  process.env.JWT_SECRET ??= "verify-script-test-secret-please-ignore-0000000000";
  ({ proxy } = await import("../proxy"));
  ({ NextRequest: NextRequestCtor } = await import("next/server"));
});

function makeRequest(method: string): NextRequest {
  return new NextRequestCtor("http://localhost/dashboard", { method });
}

it("una richiesta HEAD non autenticata viene reindirizzata al login, come una GET", async () => {
  const response = await proxy(makeRequest("HEAD"));
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("http://localhost/login");
});

it("una richiesta GET non autenticata viene reindirizzata al login (baseline invariata)", async () => {
  const response = await proxy(makeRequest("GET"));
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("http://localhost/login");
});

it("una richiesta POST non autenticata passa senza reindirizzamento (si autentica da sola)", async () => {
  const response = await proxy(makeRequest("POST"));
  expect(response.headers.get("location")).toBeNull();
});
