// SEC-08: le Server Action non hanno bisogno di questo controllo — Next.js
// confronta già da sé l'header Origin con Host (o X-Forwarded-Host) e
// scarta la richiesta se non coincidono (vedi
// node_modules/next/dist/docs/01-app/02-guides/server-actions.md, sezione
// "CSRF check"). Le route in app/api/**/route.ts non passano da quel
// controllo: proxy.ts le esclude dal proprio matcher (vedi CLAUDE.md), e
// nessuna protezione equivalente esiste per loro. Questa funzione replica
// lo stesso confronto per usarlo esplicitamente nelle route POST che
// mutano/espongono dati sensibili.
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
