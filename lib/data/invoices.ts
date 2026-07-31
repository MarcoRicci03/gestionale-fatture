import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { INVOICE_MITTENTE_SELECT } from "@/lib/data/invoice-mittente-select";
import {
  PAYER_OPTION_SELECT,
  PATIENT_OPTION_SELECT,
} from "@/lib/data/invoice-contact-options-select";
import { buildInvoiceWhere, lastValidPage } from "@/lib/invoices/list-query";
import { INVOICES_PAGE_SIZE } from "@/lib/constants/invoices";
import type { InvoiceFilters } from "@/components/invoices/invoice-filters";
import type { Prisma } from "@prisma/client";

function findInvoicesPage(where: Prisma.PagamentoWhereInput, page: number) {
  return prisma.pagamento.findMany({
    where,
    include: { pagante: true, paziente: true, mesi: true },
    // `id` come tiebreaker: `data` non è univoca (più fatture nello stesso
    // giorno) e Postgres non garantisce un ordine stabile tra le righe a
    // parità di chiave d'ordinamento, né che quell'ordine resti lo stesso
    // tra la query di pagina 1 e quella di pagina 2. Senza un secondo
    // criterio univoco, una riga può comparire su due pagine consecutive o
    // sparire del tutto mentre si pagina.
    orderBy: [{ data: "desc" }, { id: "desc" }],
    skip: (page - 1) * INVOICES_PAGE_SIZE,
    take: INVOICES_PAGE_SIZE,
  });
}

export async function getInvoices(filters: InvoiceFilters, page: number) {
  const userId = await requireUserId();
  // Nessun filtro su pagante/paziente.archiviato: una fattura è un documento
  // fiscale e resta visibile anche se il pagante o il paziente collegato
  // sono stati archiviati nel frattempo (vedi lib/actions/payers.ts,
  // lib/actions/patients.ts).
  const where = buildInvoiceWhere(userId, filters);
  const [invoices, totalCount] = await Promise.all([
    findInvoicesPage(where, page),
    prisma.pagamento.count({ where }),
  ]);

  // Se `page` è oltre l'ultima pagina disponibile per questo filtro (l'utente
  // era sull'ultima pagina e ha cancellato l'unica fattura rimasta lì, o ha
  // manomesso l'URL), la query sopra ha eseguito uno skip fuori range e ha
  // restituito 0 righe: senza questa correzione la UI mostrerebbe il
  // messaggio fuorviante "nessuna fattura corrisponde ai filtri" (falso, ce
  // ne sono) senza nessun controllo di paginazione per tornare indietro. Si
  // clampa alla pagina valida più vicina e si rifà la query solo in questo
  // caso raro (il percorso comune, `page` già in range, resta una singola
  // query in Promise.all sopra).
  const clampedPage = Math.min(page, lastValidPage(totalCount, INVOICES_PAGE_SIZE));
  const effectiveInvoices =
    clampedPage === page ? invoices : await findInvoicesPage(where, clampedPage);

  return {
    invoices: effectiveInvoices.map((invoice) => ({
      ...invoice,
      prezzo_totale: invoice.prezzo_totale.toNumber(),
      mesi: invoice.mesi.map((m) => ({ ...m, prezzo: m.prezzo.toNumber() })),
    })),
    totalCount,
    page: clampedPage,
  };
}

// Anni distinti su TUTTE le fatture dell'utente, non solo sulla pagina/i
// filtri correnti: popola il menu a tendina "Anno" del filtro, che deve
// restare stabile indipendentemente da cosa mostra la pagina in quel
// momento (stesso comportamento di oggi, quando "years" era calcolato lato
// client sull'intero array non filtrato).
// PERF-05: groupBy invece di findMany + distinct — a differenza di SQL,
// `distinct` di Prisma non si traduce in un vero DISTINCT lato database:
// esegue la query completa e deduplica lato client, quindi leggeva la
// colonna `anno` di OGNI fattura dell'utente a ogni caricamento di
// /invoices. `groupBy` genera invece un vero `GROUP BY` lato Postgres.
export async function getInvoiceYears(): Promise<number[]> {
  const userId = await requireUserId();
  const rows = await prisma.pagamento.groupBy({
    by: ["anno"],
    where: { id_Utente: userId },
    orderBy: { anno: "desc" },
  });
  return rows.map((r) => r.anno);
}

export async function getInvoiceById(id: number) {
  const userId = await requireUserId();
  // Vedi nota in getInvoices: nessun filtro su archiviato, altrimenti la
  // vista di dettaglio e la generazione PDF sparirebbero per le fatture di
  // un pagante/paziente archiviato.
  const invoice = await prisma.pagamento.findFirst({
    where: { id, id_Utente: userId },
    include: {
      pagante: true,
      paziente: true,
      mesi: true,
      // select esplicito, non `utente: true`: vedi
      // lib/data/invoice-mittente-select.ts per il motivo (evitare che
      // passwordHash entri in memoria e finisca, con un futuro chiamante
      // client, nel payload RSC).
      utente: { select: INVOICE_MITTENTE_SELECT },
    },
  });
  if (!invoice) return null;
  return {
    ...invoice,
    prezzo_totale: invoice.prezzo_totale.toNumber(),
    mesi: invoice.mesi.map((m) => ({ ...m, prezzo: m.prezzo.toNumber() })),
  };
}

export async function getNextInvoiceNumberForUserYear(
  userId: number,
  year: number,
  excludeId?: number
): Promise<number> {
  const last = await prisma.pagamento.findFirst({
    where: {
      id_Utente: userId,
      anno: year,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    orderBy: { n_fattura: "desc" },
  });
  return (last?.n_fattura ?? 0) + 1;
}

export async function getNextInvoiceNumber(year: number): Promise<number> {
  const userId = await requireUserId();
  return getNextInvoiceNumberForUserYear(userId, year);
}

export async function getChronologyNeighbors(
  userId: number,
  anno: number,
  nFattura: number,
  excludeId?: number
): Promise<{
  previous: { n_fattura: number; data: Date } | null;
  next: { n_fattura: number; data: Date } | null;
}> {
  // Nessun filtro di stato: il controllo di consequenzialità cronologica
  // considera tutte le fatture dell'anno.
  const [previous, next] = await Promise.all([
    prisma.pagamento.findFirst({
      where: {
        id_Utente: userId,
        anno,
        n_fattura: { lt: nFattura },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      orderBy: { n_fattura: "desc" },
      select: { n_fattura: true, data: true },
    }),
    prisma.pagamento.findFirst({
      where: {
        id_Utente: userId,
        anno,
        n_fattura: { gt: nFattura },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      orderBy: { n_fattura: "asc" },
      select: { n_fattura: true, data: true },
    }),
  ]);
  return { previous, next };
}

export async function getPayersAndPatients() {
  const userId = await requireUserId();
  const [payers, patients] = await Promise.all([
    prisma.pagante.findMany({
      where: { id_Utente: userId, archiviato: false },
      select: PAYER_OPTION_SELECT,
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    }),
    // Niente `include: { pagante: true }` (PERF-02): le tendine del form
    // fattura non leggono il pagante annidato dei pazienti in elenco, solo
    // id_Pagante per filtrare le opzioni. withCurrentPatient
    // (lib/invoices/contact-options.ts) lo aggiunge da sé, con l'oggetto
    // pagante già disponibile, solo per il paziente della fattura in
    // modifica se archiviato.
    prisma.paziente.findMany({
      where: { id_Utente: userId, archiviato: false },
      select: PATIENT_OPTION_SELECT,
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    }),
  ]);
  return { payers, patients };
}

// I confini di anno/mese sono costruiti con new Date(anno, mese, ...), cioè
// in ora locale DEL PROCESSO. Le date fattura sono costruite a mezzogiorno
// locale (lib/utils/date.ts) dal client Europe/Rome, quindi questi range devono
// essere calcolati nello stesso fuso: il processo è pinnato a Europe/Rome
// (Dockerfile ENV TZ, e prefisso TZ sugli script dev/start in package.json).
function yearRange(year: number) {
  return {
    gte: new Date(year, 0, 1),
    lt: new Date(year + 1, 0, 1),
  };
}

export async function getAnnualRevenue(year: number) {
  const userId = await requireUserId();
  const result = await prisma.pagamento.aggregate({
    where: {
      id_Utente: userId,
      data: yearRange(year),
    },
    _sum: { prezzo_totale: true },
  });
  return result._sum.prezzo_totale?.toNumber() ?? 0;
}

export async function getMonthlyRevenue(year: number, month: number) {
  const userId = await requireUserId();
  const result = await prisma.pagamento.aggregate({
    where: {
      id_Utente: userId,
      data: {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      },
    },
    _sum: { prezzo_totale: true },
  });
  return result._sum.prezzo_totale?.toNumber() ?? 0;
}

export async function getLatestInvoices(limit: number) {
  const userId = await requireUserId();
  // Vedi nota in getInvoices: nessun filtro su archiviato.
  const invoices = await prisma.pagamento.findMany({
    where: { id_Utente: userId },
    include: { pagante: true, paziente: true, mesi: true },
    orderBy: { data: "desc" },
    take: limit,
  });
  return invoices.map((invoice) => ({
    ...invoice,
    prezzo_totale: invoice.prezzo_totale.toNumber(),
    mesi: invoice.mesi.map((m) => ({ ...m, prezzo: m.prezzo.toNumber() })),
  }));
}
