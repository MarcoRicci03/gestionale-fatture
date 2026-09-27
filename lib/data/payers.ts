import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { findRestoreConflict } from "@/lib/archive/guards";
import { buildPayerWhere } from "@/lib/payers/list-query";
import { calculatePagination, clampPage } from "@/lib/utils/pagination";
import { PAYERS_PAGE_SIZE } from "@/lib/constants/payers";

function findPayersPage(
  where: Prisma.PaganteWhereInput,
  page: number,
  pageSize: number = PAYERS_PAGE_SIZE
) {
  const { skip, take } = calculatePagination(page, pageSize);
  return prisma.pagante.findMany({
    where,
    include: {
      pazienti: {
        where: { archiviato: false },
        orderBy: [{ cognome: "asc" }, { nome: "asc" }],
      },
    },
    // `id` come tiebreaker: cognome/nome non sono univoci, vedi lo stesso
    // ragionamento in lib/invoices/list-query.ts/findInvoicesPage.
    orderBy: [{ cognome: "asc" }, { nome: "asc" }, { id: "asc" }],
    skip,
    take,
  });
}

export async function getPayers(
  search: string,
  page: number,
  pageSize: number = PAYERS_PAGE_SIZE
) {
  const userId = await requireUserId();
  const where = buildPayerWhere(userId, { search, archiviato: false });
  const [payers, totalCount] = await Promise.all([
    findPayersPage(where, page, pageSize),
    prisma.pagante.count({ where }),
  ]);

  const clampedPage = clampPage(page, totalCount, pageSize);
  const effectivePayers =
    clampedPage === page ? payers : await findPayersPage(where, clampedPage, pageSize);

  return { payers: effectivePayers, totalCount, page: clampedPage };
}

export async function getPayerById(id: number) {
  const userId = await requireUserId();
  return prisma.pagante.findFirst({
    where: { id, id_Utente: userId, archiviato: false },
  });
}

export type ArchivedPayerRow = Awaited<
  ReturnType<typeof getArchivedPayers>
>["payers"][number];

function findArchivedPayersPage(
  where: Prisma.PaganteWhereInput,
  page: number,
  pageSize: number = PAYERS_PAGE_SIZE
) {
  const { skip, take } = calculatePagination(page, pageSize);
  return prisma.pagante.findMany({
    where,
    orderBy: [{ cognome: "asc" }, { nome: "asc" }, { id: "asc" }],
    skip,
    take,
  });
}

export async function getArchivedPayers(
  search: string,
  page: number,
  pageSize: number = PAYERS_PAGE_SIZE
) {
  const userId = await requireUserId();
  const where = buildPayerWhere(userId, { search, archiviato: true });

  const [payers, totalCount] = await Promise.all([
    findArchivedPayersPage(where, page, pageSize),
    prisma.pagante.count({ where }),
  ]);

  const clampedPage = clampPage(page, totalCount, pageSize);
  const effectivePayers =
    clampedPage === page ? payers : await findArchivedPayersPage(where, clampedPage, pageSize);

  if (effectivePayers.length === 0) {
    return { payers: [], totalCount, page: clampedPage };
  }

  // I conteggi fatture/pazienti vanno calcolati solo sugli id della pagina
  // corrente (effectivePayers), non su tutto l'elenco archiviato.
  // Anche la ricerca di eventuali conflitti di ripristino (PERF-03) viene
  // ristretta ai soli CF e P.IVA presenti nella pagina corrente anziché
  // caricare in memoria l'intera anagrafica attiva dello studio.
  const ids = effectivePayers.map((p) => p.id);
  const pageCfs = effectivePayers.map((p) => p.cf).filter((cf): cf is string => Boolean(cf));
  const pagePivas = effectivePayers.map((p) => p.piva).filter((p): p is string => Boolean(p));

  const [activePayers, fattureByPayer, pazientiByPayer] = await Promise.all([
    pageCfs.length > 0 || pagePivas.length > 0
      ? prisma.pagante.findMany({
          where: {
            id_Utente: userId,
            archiviato: false,
            OR: [
              ...(pageCfs.length > 0 ? [{ cf: { in: pageCfs } }] : []),
              ...(pagePivas.length > 0 ? [{ piva: { in: pagePivas } }] : []),
            ],
          },
          select: { id: true, cf: true, piva: true },
        })
      : Promise.resolve([]),
    prisma.pagamento.groupBy({
      by: ["id_Pagante"],
      where: { id_Utente: userId, id_Pagante: { in: ids } },
      _count: { _all: true },
      _sum: { prezzo_totale: true },
      _min: { anno: true },
      _max: { anno: true },
    }),
    prisma.paziente.groupBy({
      by: ["id_Pagante", "archiviato", "archiviatoInCascata"],
      where: { id_Utente: userId, id_Pagante: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const fattureMap = new Map(fattureByPayer.map((f) => [f.id_Pagante, f]));

  const payersWithStats = effectivePayers.map((payer) => {
    const fatture = fattureMap.get(payer.id);
    // Solo i pazienti archiviati IN CASCATA da questo pagante: sono quelli
    // che restorePayer ripristinerà davvero (LOG-09) — un paziente
    // archiviato manualmente non torna attivo insieme al pagante, quindi non
    // va conteggiato nella dialog di RestorePayerButton.
    const pazientiArchiviati = pazientiByPayer
      .filter((p) => p.id_Pagante === payer.id && p.archiviato && p.archiviatoInCascata)
      .reduce((sum, p) => sum + p._count._all, 0);
    const pazientiNonArchiviati = pazientiByPayer
      .filter((p) => p.id_Pagante === payer.id && !p.archiviato)
      .reduce((sum, p) => sum + p._count._all, 0);

    return {
      ...payer,
      fattureCount: fatture?._count._all ?? 0,
      fattureTotale: fatture?._sum.prezzo_totale?.toNumber() ?? 0,
      fatturaAnnoMin: fatture?._min.anno ?? null,
      fatturaAnnoMax: fatture?._max.anno ?? null,
      pazientiArchiviati,
      pazientiNonArchiviati,
      restoreConflict: findRestoreConflict(
        { cf: payer.cf, piva: payer.piva },
        activePayers
      ),
    };
  });

  return { payers: payersWithStats, totalCount, page: clampedPage };
}

export async function getPayersForSelect() {
  const userId = await requireUserId();
  return prisma.pagante.findMany({
    where: { id_Utente: userId, archiviato: false },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
}

