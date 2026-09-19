import { prisma } from "@/lib/prisma";
import { validateCodiceFiscale } from "@/lib/sistemats/cf-validator";
import { resolveAnagrafica } from "@/lib/invoices/anagrafica-snapshot";
import { isUniqueViolationOnField } from "@/lib/prisma-errors";
import { Prisma } from "@prisma/client";
import type { CorreggiFatturaTsInput } from "@/lib/validations/sistema-ts-correction";

export type CorrectionResult =
  | {
      success: true;
      invoice: {
        id: number;
        n_fattura: number;
        anno: number;
        paganteCf: string | null;
      };
      cfModificato: boolean;
      propagaFattureInAttesa?: boolean;
      flagOpposizione?: boolean;
      aggiornaAnagrafica?: boolean;
    }
  | {
      success: false;
      error: string;
    };

export async function correggiFatturaTsService(params: {
  userId: number;
  data: CorreggiFatturaTsInput;
}): Promise<CorrectionResult> {
  const { userId, data } = params;

  const {
    invoiceId,
    paganteCf,
    aggiornaAnagrafica,
    propagaFattureInAttesa,
    flagOpposizione,
    dataPagamento,
    pagamentoTracciato,
    bolloCodice,
  } = data;

  const invoice = await prisma.pagamento.findFirst({
    where: { id: invoiceId, id_Utente: userId },
    include: { pagante: true, paziente: true },
  });

  if (!invoice) {
    return { success: false, error: "Fattura non trovata." };
  }

  if (
    invoice.stato_ts === "INVIATA" ||
    invoice.stato_ts === "IN_TRASMISSIONE" ||
    invoice.stato_ts === "DA_CANCELLARE_SU_TS"
  ) {
    return {
      success: false,
      error:
        "Non è possibile modificare i dati di una fattura già trasmessa o in fase di trasmissione.",
    };
  }

  // Validazione Codice Fiscale se non c'è opposizione del paziente
  const targetCf = paganteCf ? paganteCf.trim().toUpperCase() : null;
  if (!flagOpposizione) {
    if (!targetCf) {
      return {
        success: false,
        error:
          "È necessario inserire un Codice Fiscale valido oppure selezionare l'opposizione alla trasmissione.",
      };
    }
    const cfCheck = validateCodiceFiscale(targetCf);
    if (!cfCheck.valid) {
      return {
        success: false,
        error: cfCheck.error ?? "Codice Fiscale non valido.",
      };
    }
  }

  // Verifica unicità Codice Fiscale su altri paganti attivi dell'utente
  if (aggiornaAnagrafica && targetCf) {
    const existingPayer = await prisma.pagante.findFirst({
      where: {
        id_Utente: userId,
        archiviato: false,
        id: { not: invoice.id_Pagante },
        cf: targetCf,
      },
    });
    if (existingPayer) {
      return {
        success: false,
        error: `Il Codice Fiscale ${targetCf} è già associato ad un altro cliente (${existingPayer.cognome} ${existingPayer.nome}).`,
      };
    }
  }

  // Verifica unicità codice bollo se specificato
  if (bolloCodice) {
    const existingBollo = await prisma.pagamento.findFirst({
      where: {
        id_Utente: userId,
        bolloCodice,
        id: { not: invoice.id },
      },
    });
    if (existingBollo) {
      return {
        success: false,
        error: `Il codice marca da bollo ${bolloCodice} è già utilizzato per la fattura n. ${existingBollo.n_fattura}/${existingBollo.anno}.`,
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Aggiorna anagrafica cliente Pagante se richiesto
      if (aggiornaAnagrafica && targetCf) {
        await tx.pagante.update({
          where: { id: invoice.id_Pagante },
          data: { cf: targetCf },
        });
      }

      // 2. Prepara snapshot aggiornato per la fattura corrente
      const currentSnap = resolveAnagrafica(invoice);
      const updatedSnap = {
        ...currentSnap,
        pagante: {
          ...currentSnap.pagante,
          cf: targetCf,
        },
      };

      // 3. Aggiorna la fattura corrente
      await tx.pagamento.update({
        where: { id: invoice.id },
        data: {
          data_pagamento: dataPagamento,
          flag_opposizione: flagOpposizione,
          pagamento_tracciato: pagamentoTracciato,
          bolloCodice: bolloCodice ?? null,
          snapshotAnagrafica: updatedSnap as unknown as Prisma.InputJsonValue,
        },
      });

      // 4. Se richiesto e targetCf presente, propaga alle altre fatture DA_INVIARE dello stesso pagante
      if (propagaFattureInAttesa && targetCf) {
        const otherDrafts = await tx.pagamento.findMany({
          where: {
            id_Utente: userId,
            id_Pagante: invoice.id_Pagante,
            stato_ts: "DA_INVIARE",
            id: { not: invoice.id },
          },
          include: { pagante: true, paziente: true },
        });

        await Promise.all(
          otherDrafts.map((draft) => {
            const draftSnap = resolveAnagrafica(draft);
            const newDraftSnap = {
              ...draftSnap,
              pagante: {
                ...draftSnap.pagante,
                cf: targetCf,
              },
            };
            return tx.pagamento.update({
              where: { id: draft.id },
              data: {
                snapshotAnagrafica: newDraftSnap as unknown as Prisma.InputJsonValue,
              },
            });
          })
        );
      }
    });
  } catch (error) {
    if (isUniqueViolationOnField(error, "bolloCodice")) {
      return { success: false, error: "Codice marca da bollo già utilizzato." };
    }
    if (isUniqueViolationOnField(error, "cf")) {
      return { success: false, error: "Codice Fiscale già presente per un altro cliente." };
    }
    console.error("correggiFatturaTs error", error);
    return { success: false, error: "Errore durante il salvataggio delle modifiche." };
  }

  return {
    success: true,
    invoice: {
      id: invoice.id,
      n_fattura: invoice.n_fattura,
      anno: invoice.anno,
      paganteCf: invoice.pagante.cf,
    },
    cfModificato: targetCf !== invoice.pagante.cf,
    propagaFattureInAttesa,
    flagOpposizione,
    aggiornaAnagrafica,
  };
}
