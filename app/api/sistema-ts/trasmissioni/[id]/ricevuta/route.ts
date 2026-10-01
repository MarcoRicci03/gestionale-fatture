import { getUserIdOrNull } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createRateLimiter } from "@/lib/auth/rate-limiter";
import { isValidId } from "@/lib/validations/id";

const ricevutaDownloadLimiter = createRateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minuto
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdOrNull();
  if (userId === null) {
    return new Response("Non autenticato", { status: 401 });
  }

  const rateLimit = ricevutaDownloadLimiter.consume(String(userId));
  if (!rateLimit.allowed) {
    return new Response("Troppe richieste, riprova tra qualche istante", {
      status: 429,
      headers: rateLimit.retryAfterSeconds
        ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
        : undefined,
    });
  }

  const { id } = await params;
  const trasmissioneId = Number(id);

  if (!isValidId(trasmissioneId)) {
    return new Response("ID trasmissione non valido", { status: 400 });
  }

  const trasmissione = await prisma.trasmissioneTs.findFirst({
    where: { id: trasmissioneId, id_Utente: userId },
    select: { pdfRicevuta: true, protocollo: true },
  });

  if (!trasmissione || !trasmissione.pdfRicevuta) {
    return new Response("Ricevuta non trovata", { status: 404 });
  }

  const safeProtocollo = trasmissione.protocollo
    ? trasmissione.protocollo.replace(/[^a-zA-Z0-9_-]/g, "_")
    : String(trasmissioneId);

  const fileName = `ricevuta_${safeProtocollo}.pdf`;

  return new Response(new Uint8Array(trasmissione.pdfRicevuta), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
