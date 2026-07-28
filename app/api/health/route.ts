import { prisma } from "@/lib/prisma";

// Route pubblica di readiness/liveness per l'healthcheck Docker (DEP-05) e per
// il reverse proxy (DEP-03): nessun dato applicativo restituito, solo
// esito booleano, quindi intenzionalmente esclusa dall'autenticazione — vedi
// PUBLIC_ROUTES in scripts/verify-api-routes-auth.test.ts.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { status: 200 });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
