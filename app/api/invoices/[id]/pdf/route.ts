import { getUserIdOrNull } from "@/lib/auth/session";
import { getInvoiceById } from "@/lib/data/invoices";
import { generateInvoicePdf } from "@/lib/pdf/invoices";
import { createRateLimiter } from "@/lib/auth/rate-limiter";

// La generazione PDF (@react-pdf/renderer) è costosa in CPU: senza un
// limite, un client autenticato può saturare il processo Node richiedendo
// PDF in loop.
const pdfGenerationLimiter = createRateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minuto
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdOrNull();
  if (userId === null) {
    // 401 esplicito, non un redirect a /login: un client API non deve
    // ricevere un 307 con corpo HTML.
    return new Response("Non autenticato", { status: 401 });
  }

  const rateLimit = pdfGenerationLimiter.consume(String(userId));
  if (!rateLimit.allowed) {
    return new Response("Troppe richieste, riprova tra qualche istante", {
      status: 429,
      headers: rateLimit.retryAfterSeconds
        ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
        : undefined,
    });
  }

  const { id } = await params;
  const invoiceId = Number(id);

  if (Number.isNaN(invoiceId)) {
    return new Response("ID fattura non valido", { status: 400 });
  }

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice || !invoice.pagante || !invoice.paziente || !invoice.utente) {
    return new Response("Fattura non trovata", { status: 404 });
  }

  const buffer = await generateInvoicePdf(invoice);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="fattura-${invoice.n_fattura}.pdf"`,
      // Il PDF contiene dati sanitari/fiscali del paziente e del pagante:
      // non va cacheato né da proxy intermedi né dal browser.
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
