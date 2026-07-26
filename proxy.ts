import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/jwt";

export const config = {
  // Il lookahead è ancorato a un confine di segmento con (?:/|$), non solo
  // al prefisso: senza l'ancoraggio, un percorso che INIZIA con una di
  // queste stringhe (es. "/logins", "/api-docs") sfuggirebbe al controllo
  // di sessione qui sotto pur non essendo affatto la route pensata come
  // pubblica.
  matcher: [
    "/((?!(?:login|api|_next/static|_next/image|favicon\\.ico|robots\\.txt)(?:/|$)).*)",
  ],
};

export async function proxy(request: NextRequest) {
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
    return NextResponse.next();
  }

  const token = request.cookies.get("session_token")?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}
