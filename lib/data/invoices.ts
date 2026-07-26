import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { INVOICE_MITTENTE_SELECT } from "@/lib/data/invoice-mittente-select";

export async function getInvoices() {
  const userId = await requireUserId();
  // Nessun filtro su pagante/paziente.archiviato: una fattura è un documento
  // fiscale e resta visibile anche se il pagante o il paziente collegato
  // sono stati archiviati nel frattempo (vedi lib/actions/payers.ts,
  // lib/actions/patients.ts).
  const invoices = await prisma.pagamento.findMany({
    where: { id_Utente: userId },
    include: { pagante: true, paziente: true, mesi: true },
    orderBy: { data: "desc" },
  });
  // Prisma.Decimal non è serializzabile attraverso il boundary Server -> Client
  // Component: va convertito a number prima di restituire i dati.
  return invoices.map((invoice) => ({
    ...invoice,
    prezzo_totale: invoice.prezzo_totale.toNumber(),
    mesi: invoice.mesi.map((m) => ({ ...m, prezzo: m.prezzo.toNumber() })),
  }));
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
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    }),
    prisma.paziente.findMany({
      where: { id_Utente: userId, archiviato: false },
      include: { pagante: true },
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
