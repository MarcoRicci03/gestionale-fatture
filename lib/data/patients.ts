import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";

export async function getPatients() {
  const userId = await requireUserId();
  return prisma.paziente.findMany({
    where: { id_Utente: userId, eliminato: false },
    include: { pagante: true },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
}

export async function getPatientById(id: number) {
  const userId = await requireUserId();
  return prisma.paziente.findFirst({
    where: { id, id_Utente: userId, eliminato: false },
    include: { pagante: true },
  });
}

export async function getPatientsForSelect() {
  const userId = await requireUserId();
  return prisma.paziente.findMany({
    where: { id_Utente: userId, eliminato: false },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, cognome: true },
  });
}

export async function getPayersForSelect() {
  const userId = await requireUserId();
  return prisma.pagante.findMany({
    where: { id_Utente: userId, eliminato: false },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
}
