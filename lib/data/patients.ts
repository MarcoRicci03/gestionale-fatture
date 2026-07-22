import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";

export async function getPatients() {
  const userId = await requireUserId();
  return prisma.paziente.findMany({
    where: { id_Utente: userId, archiviato: false },
    include: { pagante: true },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
}

export async function getPatientById(id: number) {
  const userId = await requireUserId();
  return prisma.paziente.findFirst({
    where: { id, id_Utente: userId, archiviato: false },
    include: { pagante: true },
  });
}

export async function getPatientsForSelect() {
  const userId = await requireUserId();
  return prisma.paziente.findMany({
    where: { id_Utente: userId, archiviato: false },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, cognome: true },
  });
}

export async function getPayersForSelect() {
  const userId = await requireUserId();
  return prisma.pagante.findMany({
    where: { id_Utente: userId, archiviato: false },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
}

export type ArchivedPatientRow = Awaited<
  ReturnType<typeof getArchivedPatients>
>[number];

export async function getArchivedPatients() {
  const userId = await requireUserId();

  const patients = await prisma.paziente.findMany({
    where: { id_Utente: userId, archiviato: true },
    include: {
      pagante: { select: { id: true, nome: true, cognome: true, archiviato: true } },
    },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });

  if (patients.length === 0) return [];

  const ids = patients.map((p) => p.id);
  const fattureByPatient = await prisma.pagamento.groupBy({
    by: ["id_Paziente"],
    where: { id_Utente: userId, id_Paziente: { in: ids } },
    _count: { _all: true },
    _sum: { prezzo_totale: true },
    _min: { anno: true },
    _max: { anno: true },
  });

  const fattureMap = new Map(fattureByPatient.map((f) => [f.id_Paziente, f]));

  return patients.map((patient) => {
    const fatture = fattureMap.get(patient.id);
    return {
      ...patient,
      fattureCount: fatture?._count._all ?? 0,
      fattureTotale: fatture?._sum.prezzo_totale?.toNumber() ?? 0,
      fatturaAnnoMin: fatture?._min.anno ?? null,
      fatturaAnnoMax: fatture?._max.anno ?? null,
    };
  });
}
