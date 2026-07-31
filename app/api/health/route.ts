import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/auth/client-ip";
import { createRateLimiter } from "@/lib/auth/rate-limiter";

export const dynamic = 'force-dynamic';

// SEC-07: essendo l'unica route non autenticata dell'app, un client anonimo
// potrebbe martellarla in loop per esaurire il pool `pg` (max: 10,
// lib/prisma.ts) e degradare tutta l'app. Stesso pattern di
// app/api/invoices/export/route.ts e app/api/invoices/[id]/pdf/route.ts, ma
// con chiave sull'IP invece che su userId (qui non c'è sessione). Senza
// TRUSTED_PROXY=true tutte le richieste anonime ricadono sulla stessa chiave
// "unknown" (vedi lib/auth/client-ip.ts): budget condiviso invece che per-IP,
// ma comunque un tetto — mai nessun limite era peggio. L'healthcheck Docker
// (wget da 127.0.0.1 dentro il container) non porta header IP e ricade anch'esso
// su "unknown": la soglia va tenuta ben sopra la sua cadenza (interval 10s in
// docker-compose.prod.yml, cioè ~6 richieste/minuto).
const healthCheckLimiter = createRateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minuto
});

// Route pubblica di readiness/liveness per l'healthcheck Docker (DEP-05) e per
// il reverse proxy (DEP-03): nessun dato applicativo restituito, solo
// esito booleano, quindi intenzionalmente esclusa dall'autenticazione — vedi
// PUBLIC_ROUTES in scripts/verify-api-routes-auth.test.ts.
export async function GET() {
  const clientIp = await getClientIp();
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

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { status: 200 });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
