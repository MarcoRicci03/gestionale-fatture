import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";

export async function getInvoices() {
  const userId = await requireUserId();
  return prisma.pagamento.findMany({
    where: {
      id_Utente: userId,
      pagante: { eliminato: false },
      paziente: { eliminato: false },
    },
    include: { pagante: true, paziente: true },
    orderBy: { data: "desc" },
  });
}

export async function getInvoiceById(id: number) {
  const userId = await requireUserId();
  return prisma.pagamento.findFirst({
    where: {
      id,
      id_Utente: userId,
      pagante: { eliminato: false },
      paziente: { eliminato: false },
    },
    include: { pagante: true, paziente: true },
  });
}

export async function getNextInvoiceNumber(year: number) {
  const userId = await requireUserId();
  const last = await prisma.pagamento.findFirst({
    where: {
      id_Utente: userId,
      data: {
        gte: new Date(year, 0, 1),
        lt: new Date(year + 1, 0, 1),
      },
    },
    orderBy: { n_fattura: "desc" },
  });
  return (last?.n_fattura ?? 0) + 1;
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
