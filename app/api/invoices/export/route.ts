import { getUserIdOrNull } from "@/lib/auth/session";
import { createRateLimiter } from "@/lib/auth/rate-limiter";
import { prisma } from "@/lib/prisma";
import { invoiceExportSchema } from "@/lib/validations/invoice-export";
import { buildInvoicesWorkbook } from "@/lib/excel/invoices-export";
import { logAudit } from "@/lib/audit/log";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

// La generazione del workbook è più costosa in CPU di un singolo PDF (fino a
// 2000 righe): stesso approccio SEC-08 del route PDF, ma con soglia più
// bassa dato il costo maggiore per richiesta.
const exportLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minuto
});

export async function POST(request: Request) {
  const userId = await getUserIdOrNull();
  if (userId === null) {
    // 401 esplicito, non un redirect a /login: un client API non deve
    // ricevere un 307 con corpo HTML (vedi SEC-13 in SECURITY_AUDIT.md).
    return new Response("Non autenticato", { status: 401 });
  }

  const rateLimit = exportLimiter.consume(String(userId));
  if (!rateLimit.allowed) {
    return new Response("Troppe richieste, riprova tra qualche istante", {
      status: 429,
      headers: rateLimit.retryAfterSeconds
        ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
        : undefined,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Corpo della richiesta non valido", { status: 400 });
  }

  const parsed = invoiceExportSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Dati non validi", { status: 400 });
  }
  const { ids, columns } = parsed.data;

  // Non ci si fida degli id selezionati lato client per l'isolamento
  // multi-tenant: la query filtra sempre esplicitamente per id_Utente,
  // ignorando silenziosamente eventuali id non posseduti dall'utente.
  // Nessun filtro su pagante/paziente.archiviato: una fattura resta
  // esportabile anche se il contatto collegato è stato archiviato (vedi
  // lib/data/invoices.ts).
  const invoices = await prisma.pagamento.findMany({
    where: {
      id_Utente: userId,
      id: { in: ids },
    },
    include: { pagante: true, paziente: true, mesi: true },
    orderBy: { data: "desc" },
  });

  if (invoices.length === 0) {
    return new Response("Nessuna fattura trovata", { status: 404 });
  }

  const serializedInvoices = invoices.map((invoice) => ({
    ...invoice,
    prezzo_totale: invoice.prezzo_totale.toNumber(),
    mesi: invoice.mesi.map((m) => ({ ...m, prezzo: m.prezzo.toNumber() })),
  }));

  const buffer = await buildInvoicesWorkbook(serializedInvoices, columns);

  await logAudit({
    userId,
    azione: AUDIT_ACTIONS.INVOICE_EXPORT,
    meta: { count: invoices.length, columns },
  });

  const filename = `fatture-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Il file contiene dati sanitari/fiscali di molti pazienti e paganti:
      // non va cacheato né da proxy intermedi né dal browser (vedi SEC-07 in
      // SECURITY_AUDIT.md).
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
