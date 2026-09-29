import type { Prisma } from "@prisma/client";
import { resolveAnagrafica, type SnapshotAnagrafica } from "./anagrafica-snapshot";

// P021: propagazione dei dati del pagante agli snapshot delle sue fatture
// ancora DA_INVIARE, condivisa da updatePayer e correggiFatturaTsService.
// Va chiamata dentro la transazione del chiamante.
export async function propagaPaganteAlleBozze(
  tx: Prisma.TransactionClient,
  params: {
    userId: number;
    idPagante: number;
    pagante: Partial<SnapshotAnagrafica["pagante"]>;
    escludiId?: number;
  }
): Promise<void> {
  const { userId, idPagante, pagante, escludiId } = params;
  const bozze = await tx.pagamento.findMany({
    where: {
      id_Utente: userId,
      id_Pagante: idPagante,
      stato_ts: "DA_INVIARE",
      ...(escludiId !== undefined ? { id: { not: escludiId } } : {}),
    },
    include: { pagante: true, paziente: true },
  });

  // ponytail: un updateMany per bozza (ogni snapshot ha il suo paziente). Un
  // unico UPDATE servirebbe SQL grezzo con jsonb_set e il fallback sulle
  // relazioni live; da valutare solo se un pagante arriva a centinaia di bozze.
  await Promise.all(
    bozze.map((bozza) => {
      const snap = resolveAnagrafica(bozza);
      // CR-04/CR-12: una bozza partita per il Sistema TS nel frattempo va
      // saltata, non modificata (updateMany non lancia se non trova righe).
      return tx.pagamento.updateMany({
        where: { id: bozza.id, id_Utente: userId, stato_ts: "DA_INVIARE" },
        data: {
          snapshotAnagrafica: {
            ...snap,
            pagante: { ...snap.pagante, ...pagante },
          } as unknown as Prisma.InputJsonValue,
        },
      });
    })
  );
}
