import { isTrustedProxyEnabled } from "@/lib/auth/client-ip";

// SEC-08: le Server Action non hanno bisogno di questo controllo — Next.js
// confronta già da sé l'header Origin con Host (o X-Forwarded-Host) e
// scarta la richiesta se non coincidono (vedi
// node_modules/next/dist/docs/01-app/02-guides/server-actions.md, sezione
// "CSRF check"). Le route in app/api/**/route.ts non passano da quel
// controllo: proxy.ts le esclude dal proprio matcher (vedi CLAUDE.md), e
// nessuna protezione equivalente esiste per loro. Questa funzione replica
// lo stesso confronto per usarlo esplicitamente nelle route POST che
// mutano/espongono dati sensibili.
//
// SEC-06: X-Forwarded-Host è manipolabile direttamente dal client (attaccante)
// a meno che l'applicazione non sia protetta da un reverse proxy fidato
// configurato per sovrascriverlo. Pertanto, l'header X-Forwarded-Host viene
// letto SOLO se TRUSTED_PROXY=true (isTrustedProxyEnabled()), altrimenti
// decade esclusivamente sull'header Host canonico.
export function normalizeHost(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.endsWith(":80")) return trimmed.slice(0, -3);
  if (trimmed.endsWith(":443")) return trimmed.slice(0, -4);
  return trimmed;
}

export function resolveRequestHost(
  request: Request,
  trustedProxy: boolean
): string | null {
  if (trustedProxy) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    if (forwardedHost) {
      const first = forwardedHost.split(",")[0]?.trim();
      if (first) return first;
    }
  }
  return request.headers.get("host");
}

export function isSameOriginRequest(
  request: Request,
  options?: { trustedProxy?: boolean }
): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const trustedProxy = options?.trustedProxy ?? isTrustedProxyEnabled();
  const host = resolveRequestHost(request, trustedProxy);
  if (!host) return false;

  try {
    const originHost = normalizeHost(new URL(origin).host);
    const targetHost = normalizeHost(host);
    return originHost === targetHost;
  } catch {
    return false;
  }
}
