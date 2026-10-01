import { prisma } from "@/lib/prisma";
import { validateCodiceFiscale } from "@/lib/sistemats/cf-validator";
import { resolveAnagrafica } from "@/lib/invoices/anagrafica-snapshot";
import { propagaPaganteAlleBozze } from "@/lib/invoices/propaga-anagrafica";
import { isUniqueViolationOnField, isRecordNotFoundError } from "@/lib/prisma-errors";
import { Prisma } from "@prisma/client";
import { calcolaTotaliFattura } from "@/lib/fiscal/bollo";
import type { CorreggiFatturaTsData } from "@/lib/validations/sistema-ts-correction";
import { FATTURA_ANNULLATA_TS_EDIT_ERROR } from "@/lib/invoices/errors";

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

class PaganteNonTrovatoError extends Error {}

const FATTURA_TRASMESSA_ERROR =
  "Non è possibile modificare i dati di una fattura già trasmessa o in fase di trasmissione.";

export async function correggiFatturaTsService(params: {
  userId: number;
  data: CorreggiFatturaTsData;
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
    return { success: false, error: FATTURA_TRASMESSA_ERROR };
  }

  // P007: stessa regola di updateInvoice, una fattura annullata su TS va
  // prima ripristinata.
  if (invoice.stato_ts === "ANNULLATA_TS") {
    return { success: false, error: FATTURA_ANNULLATA_TS_EDIT_ERROR };
  }

  // CR-05: i campi omessi valgono come "invariati". L'opposizione effettiva è
  // quella inviata o, in assenza, quella già salvata; il CF dello snapshot non
  // viene mai svuotato (l'opposizione riguarda solo l'invio a Sistema TS, il
  // CF resta sulla fattura).
  const opposizioneEffettiva = flagOpposizione ?? invoice.flag_opposizione;
  const currentSnap = resolveAnagrafica(invoice);
  const nuovoCf = paganteCf ? paganteCf.trim().toUpperCase() : null;
  const cfEffettivo = nuovoCf ?? currentSnap.pagante.cf;

  // Validazione Codice Fiscale se non c'è opposizione del paziente
  if (!opposizioneEffettiva) {
    if (!cfEffettivo) {
      return {
        success: false,
        error:
          "È necessario inserire un Codice Fiscale valido oppure selezionare l'opposizione alla trasmissione.",
      };
    }
    const cfCheck = validateCodiceFiscale(cfEffettivo);
    if (!cfCheck.valid) {
      return {
        success: false,
        error: cfCheck.error ?? "Codice Fiscale non valido.",
      };
    }
  }

  // Verifica unicità Codice Fiscale su altri paganti attivi dell'utente
  if (aggiornaAnagrafica && nuovoCf) {
    const existingPayer = await prisma.pagante.findFirst({
      where: {
        id_Utente: userId,
        archiviato: false,
        id: { not: invoice.id_Pagante },
        cf: nuovoCf,
      },
    });
    if (existingPayer) {
      return {
        success: false,
        error: `Il Codice Fiscale ${nuovoCf} è già associato ad un altro cliente (${existingPayer.cognome} ${existingPayer.nome}).`,
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
      if (aggiornaAnagrafica && nuovoCf) {
        // updateMany invece di update: con update un P2025 finirebbe nel ramo
        // isRecordNotFoundError e mostrerebbe "fattura già trasmessa". Qui
        // il pagante manca o non è dell'utente, un errore diverso.
        const { count } = await tx.pagante.updateMany({
          where: { id: invoice.id_Pagante, id_Utente: userId },
          data: { cf: nuovoCf },
        });
        if (count === 0) {
          throw new PaganteNonTrovatoError();
        }
      }

      // 2. Prepara snapshot aggiornato per la fattura corrente
      const updatedSnap = {
        ...currentSnap,
        pagante: {
          ...currentSnap.pagante,
          cf: cfEffettivo,
        },
      };

      // 3. Aggiorna la fattura corrente. CR-05: un valore `undefined` (campo non
      // inviato) viene ignorato da Prisma e lascia il campo invariato; `null`
      // esplicito lo svuota. CR-12: lo stato letto viene ricontrollato nella
      // scrittura; se un invio l'ha bloccata nel frattempo, P2025.
      await tx.pagamento.update({
        where: { id: invoice.id, id_Utente: userId, stato_ts: invoice.stato_ts },
        data: {
          data_pagamento: dataPagamento,
          flag_opposizione: flagOpposizione,
          pagamento_tracciato: pagamentoTracciato,
          bolloCodice,
          // P006: `bollo` segue sempre bolloCodice, come in create/updateInvoice.
          ...(bolloCodice !== undefined
            ? {
                bollo: new Prisma.Decimal(
                  calcolaTotaliFattura(invoice.prezzo_totale.toNumber(), bolloCodice).bolloImporto
                ),
              }
            : {}),
          snapshotAnagrafica: updatedSnap as unknown as Prisma.InputJsonValue,
        },
      });

      // 4. Se richiesto e un nuovo CF è stato inviato, propaga alle altre fatture DA_INVIARE dello stesso pagante
      if (propagaFattureInAttesa && nuovoCf) {
        await propagaPaganteAlleBozze(tx, {
          userId,
          idPagante: invoice.id_Pagante,
          pagante: { cf: nuovoCf },
          escludiId: invoice.id,
        });
      }
    });
  } catch (error) {
    if (error instanceof PaganteNonTrovatoError) {
      return { success: false, error: "Cliente non trovato." };
    }
    if (isRecordNotFoundError(error)) {
      return { success: false, error: FATTURA_TRASMESSA_ERROR };
    }
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
    cfModificato: nuovoCf !== null && nuovoCf !== currentSnap.pagante.cf,
    propagaFattureInAttesa,
    flagOpposizione: opposizioneEffettiva,
    aggiornaAnagrafica,
  };
}
