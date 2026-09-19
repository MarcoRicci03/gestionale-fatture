import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolveClientIp, isTrustedProxyEnabled } from "@/lib/auth/client-ip";
import { createRateLimiter } from "@/lib/auth/rate-limiter";

export const dynamic = 'force-dynamic';

export const INTERNAL_HEALTHCHECK_HEADER = "x-healthcheck-internal";

// SEC-07: essendo l'unica route non autenticata dell'app, un client anonimo
// potrebbe martellarla in loop per esaurire il pool `pg` (max: 10,
// lib/prisma.ts) e degradare tutta l'app. Stesso pattern di
// app/api/invoices/export/route.ts e app/api/invoices/[id]/pdf/route.ts, ma
// con chiave sull'IP invece che su userId (qui non c'è sessione). Senza
// TRUSTED_PROXY=true tutte le richieste anonime ricadono sulla stessa chiave
// "unknown" (vedi lib/auth/client-ip.ts): budget condiviso invece che per-IP,
// ma comunque un tetto — mai nessun limite era peggio.
//
// SEC-CRIT: L'healthcheck Docker (wget da 127.0.0.1 dentro il container) non
// deve condividere né consumare il budget del rate limit pubblico: altrimenti,
// un attaccante esterno che invia 30 richieste satura la chiave "unknown" e fa
// fallire l'healthcheck di Docker (HTTP 429), provocando il riavvio in loop del
// container (Denial of Service).
export const healthCheckLimiter = createRateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minuto
});

/**
 * Determina se una richiesta proviene in modo verificabile dal container locale
 * (healthcheck Docker interno via 127.0.0.1/localhost).
 *
 * Difesa in profondità:
 * 1. La presenza di header di proxy inverso (CF-Connecting-IP, X-Forwarded-For,
 *    X-Real-IP, X-Forwarded-Host) indica inequivocabilmente che la richiesta è
 *    transitata da un proxy/edge pubblico: viene quindi trattata come ESTERNA,
 *    anche se tentasse di iniettare X-Healthcheck-Internal o Host loopback.
 * 2. L'header Host deve essere un indirizzo di loopback (127.0.0.1 o localhost).
 * 3. Deve essere presente l'header dedicato X-Healthcheck-Internal: 1 impostato
 *    dal comando wget in docker-compose.prod.yml.
 */
export function isInternalHealthcheck(headersList: { get(name: string): string | null }): boolean {
  if (
    headersList.get("cf-connecting-ip") ||
    headersList.get("x-forwarded-for") ||
    headersList.get("x-real-ip") ||
    headersList.get("x-forwarded-host")
  ) {
    return false;
  }

  const internalHeader = headersList.get(INTERNAL_HEALTHCHECK_HEADER);
  if (internalHeader !== "1") {
    return false;
  }

  const host = headersList.get("host") ?? "";
  const isLoopback =
    host.startsWith("127.0.0.1") ||
    host.startsWith("localhost") ||
    host.startsWith("[::1]");

  return isLoopback;
}

// Route pubblica di readiness/liveness per l'healthcheck Docker (DEP-05) e per
// il reverse proxy (DEP-03): nessun dato applicativo restituito, solo
// esito booleano, quindi intenzionalmente esclusa dall'autenticazione — vedi
// PUBLIC_ROUTES in scripts/verify-api-routes-auth.test.ts.
export async function GET(request?: Request) {
  const headersList = request ? request.headers : await headers();
  const isInternal = isInternalHealthcheck(headersList);

  if (!isInternal) {
    const clientIp = resolveClientIp(headersList, isTrustedProxyEnabled());
    const rateLimit = healthCheckLimiter.consume(clientIp);
    if (!rateLimit.allowed) {
      return Response.json(
        { status: "error" },
        {
          status: 429,
          headers: rateLimit.retryAfterSeconds
            ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
            : undefined,
        }
      );
    }
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { status: 200 });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
