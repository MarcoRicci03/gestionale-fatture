import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { findRestoreConflict } from "@/lib/archive/guards";
import { buildPayerWhere } from "@/lib/payers/list-query";
import { lastValidPage } from "@/lib/utils/pagination";
import { PAYERS_PAGE_SIZE } from "@/lib/constants/payers";

function findPayersPage(where: Prisma.PaganteWhereInput, page: number) {
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
    skip: (page - 1) * PAYERS_PAGE_SIZE,
    take: PAYERS_PAGE_SIZE,
  });
}

export async function getPayers(search: string, page: number) {
  const userId = await requireUserId();
  const where = buildPayerWhere(userId, { search, archiviato: false });
  const [payers, totalCount] = await Promise.all([
    findPayersPage(where, page),
    prisma.pagante.count({ where }),
  ]);

  const clampedPage = Math.min(page, lastValidPage(totalCount, PAYERS_PAGE_SIZE));
  const effectivePayers =
    clampedPage === page ? payers : await findPayersPage(where, clampedPage);

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

function findArchivedPayersPage(where: Prisma.PaganteWhereInput, page: number) {
  return prisma.pagante.findMany({
    where,
    orderBy: [{ cognome: "asc" }, { nome: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAYERS_PAGE_SIZE,
    take: PAYERS_PAGE_SIZE,
  });
}

export async function getArchivedPayers(search: string, page: number) {
  const userId = await requireUserId();
  const where = buildPayerWhere(userId, { search, archiviato: true });

  const [payers, totalCount, activePayers] = await Promise.all([
    findArchivedPayersPage(where, page),
    prisma.pagante.count({ where }),
    prisma.pagante.findMany({
      where: { id_Utente: userId, archiviato: false },
      select: { id: true, cf: true, piva: true },
    }),
  ]);

  const clampedPage = Math.min(page, lastValidPage(totalCount, PAYERS_PAGE_SIZE));
  const effectivePayers =
    clampedPage === page ? payers : await findArchivedPayersPage(where, clampedPage);

  if (effectivePayers.length === 0) {
    return { payers: [], totalCount, page: clampedPage };
  }

  // I conteggi fatture/pazienti vanno calcolati solo sugli id della pagina
  // corrente (effectivePayers), non su tutto l'elenco archiviato: activePayers
  // resta invece su tutta l'anagrafica attiva, serve a findRestoreConflict
  // sotto per rilevare conflitti CF/P.IVA indipendentemente da quali
  // paganti archiviati sono in questa pagina.
  const ids = effectivePayers.map((p) => p.id);

  const [fattureByPayer, pazientiByPayer] = await Promise.all([
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
