import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";

export async function getPayers() {
  const userId = await requireUserId();
  return prisma.pagante.findMany({
    where: { id_Utente: userId, eliminato: false },
    include: {
      pazienti: {
        where: { eliminato: false },
        orderBy: [{ cognome: "asc" }, { nome: "asc" }],
      },
    },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
}

export async function getPayerById(id: number) {
  const userId = await requireUserId();
  return prisma.pagante.findFirst({
    where: { id, id_Utente: userId, eliminato: false },
  });
}
