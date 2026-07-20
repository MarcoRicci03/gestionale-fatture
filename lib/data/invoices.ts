import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";

export async function getInvoices() {
  const userId = await requireUserId();
  const invoices = await prisma.pagamento.findMany({
    where: {
      id_Utente: userId,
      pagante: { eliminato: false },
      paziente: { eliminato: false },
    },
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
  const invoice = await prisma.pagamento.findFirst({
    where: {
      id,
      id_Utente: userId,
      pagante: { eliminato: false },
      paziente: { eliminato: false },
    },
    include: { pagante: true, paziente: true, mesi: true, utente: true },
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

export async function getPayersAndPatients() {
  const userId = await requireUserId();
  const [payers, patients] = await Promise.all([
    prisma.pagante.findMany({
      where: { id_Utente: userId, eliminato: false },
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    }),
    prisma.paziente.findMany({
      where: { id_Utente: userId, eliminato: false },
      include: { pagante: true },
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    }),
  ]);
  return { payers, patients };
}

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
  const invoices = await prisma.pagamento.findMany({
    where: {
      id_Utente: userId,
      pagante: { eliminato: false },
      paziente: { eliminato: false },
    },
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
