import { getUserIdOrNull } from "@/lib/auth/session";
import { createRateLimiter } from "@/lib/auth/rate-limiter";
import { prisma } from "@/lib/prisma";
import { invoiceExportSchema, MAX_EXPORT_INVOICES } from "@/lib/validations/invoice-export";
import { buildInvoiceWhere } from "@/lib/invoices/list-query";
import { buildInvoicesWorkbook } from "@/lib/excel/invoices-export";
import { logAudit } from "@/lib/audit/log";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

// La generazione del workbook è più costosa in CPU di un singolo PDF (fino a
// 2000 righe): stesso approccio del route PDF, ma con soglia più bassa dato
// il costo maggiore per richiesta.
const exportLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minuto
});

export async function POST(request: Request) {
  const userId = await getUserIdOrNull();
  if (userId === null) {
    // 401 esplicito, non un redirect a /login: un client API non deve
    // ricevere un 307 con corpo HTML.
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
  const { columns } = parsed.data;

  // Non ci si fida degli id/filtri ricevuti dal client per l'isolamento
  // multi-tenant: in entrambi i rami il where include sempre id_Utente
  // esplicito (buildInvoiceWhere lo fa già per il ramo filters). Nessun
  // filtro su pagante/paziente.archiviato: una fattura resta esportabile
  // anche se il contatto collegato è stato archiviato (vedi
  // lib/data/invoices.ts).
  const where =
    "ids" in parsed.data
      ? { id_Utente: userId, id: { in: parsed.data.ids } }
      : buildInvoiceWhere(userId, parsed.data.filters);

  const invoices = await prisma.pagamento.findMany({
    where,
    include: { pagante: true, paziente: true, mesi: true },
    orderBy: { data: "desc" },
    // +1 per distinguere "esattamente al limite" da "oltre il limite" senza
    // una count() separata: se arrivano MAX_EXPORT_INVOICES + 1 righe, si
    // blocca invece di troncare silenziosamente l'export a metà.
    take: MAX_EXPORT_INVOICES + 1,
  });

  if (invoices.length > MAX_EXPORT_INVOICES) {
    return new Response(
      `Troppe fatture corrispondono ai filtri: restringi la selezione (massimo ${MAX_EXPORT_INVOICES})`,
      { status: 400 }
    );
  }

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
      // non va cacheato né da proxy intermedi né dal browser.
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
