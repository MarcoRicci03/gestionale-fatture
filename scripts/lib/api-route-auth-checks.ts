// Predicati puri condivisi tra scripts/verify-api-routes-auth.ts (la scansione
// reale di app/api/**/route.ts) e scripts/verify-api-route-auth-checker.ts
// (il test di regressione su questi predicati). Isolati in un modulo senza
// side-effect a livello di import, così il secondo può importarli senza far
// ripartire anche la scansione del primo.
//
// requireUserId/requireSession/requireAdmin fanno redirect("/login") in
// assenza di sessione: l'invariante è garantita strutturalmente, basta la
// presenza della chiamata. getUserIdOrNull() invece restituisce null (per
// poter rispondere 401 invece di un redirect, vedi SEC-13 in
// SECURITY_AUDIT.md) e NON basta da sola: un chiamante potrebbe ignorare il
// caso null. Per questa via si richiede quindi anche un controllo esplicito
// del null e una risposta 401 nello stesso corpo di funzione.
export const REDIRECT_BASED_AUTH_CALLS = [
  "requireUserId(",
  "requireSession(",
  "requireAdmin(",
];

export function hasRedirectBasedAuthCheck(body: string): boolean {
  return REDIRECT_BASED_AUTH_CALLS.some((call) => body.includes(call));
}

export function hasExplicit401AuthCheck(body: string): boolean {
  return (
    body.includes("getUserIdOrNull(") &&
    /===\s*null/.test(body) &&
    /status:\s*401/.test(body)
  );
}

export function hasApiRouteAuthCheck(body: string): boolean {
  return hasRedirectBasedAuthCheck(body) || hasExplicit401AuthCheck(body);
}
