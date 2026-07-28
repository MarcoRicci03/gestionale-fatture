import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/jwt";
import { buildCspHeader } from "@/lib/security/csp";

export const config = {
  // Il lookahead è ancorato a un confine di segmento con (?:/|$), non solo
  // al prefisso: senza l'ancoraggio, un percorso che INIZIA con una di
  // queste stringhe (es. "/logins", "/api-docs") sfuggirebbe al controllo
  // di sessione qui sotto pur non essendo affatto la route pensata come
  // pubblica.
  matcher: [
    "/((?!(?:login|api|_next/static|_next/image|favicon\\.ico|robots\\.txt)(?:/|$)).*)",
    // Voce indipendente, in OR con quella sopra: "/login" resta escluso dal
    // controllo di sessione (nessuna modifica alla regex sopra, che quel
    // controllo lo esprime), ma deve comunque ricevere il nonce/CSP
    // generato qui sotto (SEC-08) — altrimenti la pagina di login sarebbe
    // l'unica servita senza CSP in produzione.
    "/login",
  ],
};

export async function proxy(request: NextRequest) {
  // Nonce per-richiesta sulla CSP (SEC-08): solo in produzione, come le
  // altre righe di CONTENT_SECURITY_POLICY prima spostate qui da
  // next.config.ts — in sviluppo Turbopack inietta script eval-based e un
  // websocket di HMR che una CSP stretta bloccherebbe (vedi
  // PIANO_FIX_CSP_NONCE.md). Va impostato sia sulla request riscritta
  // (requestHeaders) sia sulla response: Next legge il nonce dall'header
  // CSP della request per applicarlo automaticamente ai propri script
  // (bootstrap dell'hydration, bundle di pagina) durante il rendering.
  const isProduction = process.env.NODE_ENV === "production";
  const requestHeaders = new Headers(request.headers);
  let response: NextResponse;

  if (isProduction) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = buildCspHeader(nonce);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", csp);
    response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("content-security-policy", csp);
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Lascia passare richieste non-GET (es. Server Actions) senza interferire:
  // ogni Server Action verifica autonomamente la sessione. Non c'è modo di
  // intercettare le Server Action qui con la stessa granularità delle route
  // GET in questa versione di Next.js — l'invariante "ogni action esportata
  // chiama requireUserId/requireSession/requireAdmin" è garantita da
  // `npm run verify:actions-auth` (scripts/verify-actions-auth.ts), non da
  // questo proxy.
  //
  // Il matcher sopra esclude anche "api": un 307 verso /login non è una
  // risposta sensata per un client API, quindi le route in
  // app/api/**/route.ts si autenticano da sole (requireUserId/requireSession/
  // requireAdmin nell'handler), come le Server Action. L'invariante è
  // garantita da `npm run verify:api-routes-auth`
  // (scripts/verify-api-routes-auth.ts).
  //
  // HEAD va trattato come GET (Next.js instrada le HEAD sulle stesse route):
  // senza escluderlo esplicitamente, una richiesta HEAD su una pagina
  // protetta salterebbe il controllo di sessione qui sotto (SEC-06). Nessun
  // leak di dati anche prima di questo fix — requireSession() nel layout
  // protetto blocca comunque l'accesso reale — ma l'invariante che questo
  // file dichiara di garantire aveva un buco.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return response;
  }

  // "/login" ora passa dal proxy (matcher sopra) solo per ricevere il
  // nonce/CSP: il controllo di sessione resta di competenza della pagina
  // stessa (app/login/page.tsx reindirizza già a /dashboard se già loggato).
  // Senza questo, una richiesta non autenticata su /login finirebbe
  // reindirizzata a se stessa.
  if (request.nextUrl.pathname === "/login") {
    return response;
  }

  const token = request.cookies.get("session_token")?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    const csp = response.headers.get("content-security-policy");
    if (csp) redirectResponse.headers.set("content-security-policy", csp);
    return redirectResponse;
  }

  return response;
}
