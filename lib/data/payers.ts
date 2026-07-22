import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { findRestoreConflict } from "@/lib/archive/guards";

export async function getPayers() {
  const userId = await requireUserId();
  return prisma.pagante.findMany({
    where: { id_Utente: userId, archiviato: false },
    include: {
      pazienti: {
        where: { archiviato: false },
        orderBy: [{ cognome: "asc" }, { nome: "asc" }],
      },
    },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });
}

export async function getPayerById(id: number) {
  const userId = await requireUserId();
  return prisma.pagante.findFirst({
    where: { id, id_Utente: userId, archiviato: false },
  });
}

export type ArchivedPayerRow = Awaited<
  ReturnType<typeof getArchivedPayers>
>[number];

export async function getArchivedPayers() {
  const userId = await requireUserId();

  const [payers, activePayers] = await Promise.all([
    prisma.pagante.findMany({
      where: { id_Utente: userId, archiviato: true },
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    }),
    prisma.pagante.findMany({
      where: { id_Utente: userId, archiviato: false },
      select: { id: true, cf: true, piva: true },
    }),
  ]);

  if (payers.length === 0) return [];

  const ids = payers.map((p) => p.id);

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
      by: ["id_Pagante", "archiviato"],
      where: { id_Utente: userId, id_Pagante: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const fattureMap = new Map(fattureByPayer.map((f) => [f.id_Pagante, f]));

  return payers.map((payer) => {
    const fatture = fattureMap.get(payer.id);
    const pazientiArchiviati = pazientiByPayer
      .filter((p) => p.id_Pagante === payer.id && p.archiviato)
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
}
