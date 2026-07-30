import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { buildPatientWhere } from "@/lib/patients/list-query";
import { lastValidPage } from "@/lib/utils/pagination";
import { PATIENTS_PAGE_SIZE } from "@/lib/constants/patients";

function findPatientsPage(where: Prisma.PazienteWhereInput, page: number) {
  return prisma.paziente.findMany({
    where,
    include: { pagante: true },
    // `id` come tiebreaker: cognome/nome non sono univoci, vedi lo stesso
    // ragionamento in lib/invoices/list-query.ts/findInvoicesPage.
    orderBy: [{ cognome: "asc" }, { nome: "asc" }, { id: "asc" }],
    skip: (page - 1) * PATIENTS_PAGE_SIZE,
    take: PATIENTS_PAGE_SIZE,
  });
}

export async function getPatients(search: string, page: number) {
  const userId = await requireUserId();
  const where = buildPatientWhere(userId, { search, archiviato: false });
  const [patients, totalCount] = await Promise.all([
    findPatientsPage(where, page),
    prisma.paziente.count({ where }),
  ]);

  const clampedPage = Math.min(page, lastValidPage(totalCount, PATIENTS_PAGE_SIZE));
  const effectivePatients =
    clampedPage === page ? patients : await findPatientsPage(where, clampedPage);

  return { patients: effectivePatients, totalCount, page: clampedPage };
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
>["patients"][number];

function findArchivedPatientsPage(
  where: Prisma.PazienteWhereInput,
  page: number
) {
  return prisma.paziente.findMany({
    where,
    include: {
      pagante: { select: { id: true, nome: true, cognome: true, archiviato: true } },
    },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }, { id: "asc" }],
    skip: (page - 1) * PATIENTS_PAGE_SIZE,
    take: PATIENTS_PAGE_SIZE,
  });
}

export async function getArchivedPatients(search: string, page: number) {
  const userId = await requireUserId();
  const where = buildPatientWhere(userId, { search, archiviato: true });

  const [patients, totalCount] = await Promise.all([
    findArchivedPatientsPage(where, page),
    prisma.paziente.count({ where }),
  ]);

  const clampedPage = Math.min(page, lastValidPage(totalCount, PATIENTS_PAGE_SIZE));
  const effectivePatients =
    clampedPage === page
      ? patients
      : await findArchivedPatientsPage(where, clampedPage);

  if (effectivePatients.length === 0) {
    return { patients: [], totalCount, page: clampedPage };
  }

  // I conteggi fatture vanno calcolati solo sugli id della pagina corrente,
  // non su tutto l'elenco archiviato: la lista che arriva al client è già
  // paginata (effectivePatients), quindi basta un groupBy su quel
  // sottoinsieme.
  const ids = effectivePatients.map((p) => p.id);
  const fattureByPatient = await prisma.pagamento.groupBy({
    by: ["id_Paziente"],
    where: { id_Utente: userId, id_Paziente: { in: ids } },
    _count: { _all: true },
    _sum: { prezzo_totale: true },
    _min: { anno: true },
    _max: { anno: true },
  });

  const fattureMap = new Map(fattureByPatient.map((f) => [f.id_Paziente, f]));

  const patientsWithStats = effectivePatients.map((patient) => {
    const fatture = fattureMap.get(patient.id);
    return {
      ...patient,
      fattureCount: fatture?._count._all ?? 0,
      fattureTotale: fatture?._sum.prezzo_totale?.toNumber() ?? 0,
      fatturaAnnoMin: fatture?._min.anno ?? null,
      fatturaAnnoMax: fatture?._max.anno ?? null,
    };
  });

  return { patients: patientsWithStats, totalCount, page: clampedPage };
}
