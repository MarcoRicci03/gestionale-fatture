import { prisma } from "@/lib/prisma";
import { getErrorsForInvoice, parseCsvErroriTs } from "@/lib/sistemats/csv-parser";
import { getClientForUser } from "./client.service";

export type ReconciliationResult =
  | {
      success: true;
      protocollo: string;
      statoElaborazione?: string;
      descrizioneEsito?: string;
    }
  | {
      success: false;
      error: string;
    };

export async function sincronizzaEsitoTrasmissioneService(params: {
  userId: number;
  trasmissioneId: number;
}): Promise<ReconciliationResult> {
  const { userId, trasmissioneId } = params;

  const trasmissione = await prisma.trasmissioneTs.findFirst({
    where: { id: trasmissioneId, id_Utente: userId },
    include: {
      fatture: {
        select: {
          id: true,
          n_fattura: true,
          anno: true,
          data: true,
        },
      },
    },
  });

  if (!trasmissione) {
    return { success: false, error: "Trasmissione non trovata." };
  }

  let clientInfo;
  try {
    clientInfo = await getClientForUser(userId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  const { client } = clientInfo;

  try {
    const esitoRes = await client.interrogaEsito(trasmissione.protocollo);

    if (!esitoRes.success) {
      return { success: false, error: esitoRes.errorMessage || "Interrogazione esito non riuscita." };
    }

    let pdfBytes: Buffer | undefined;
    let csvText: string | undefined;

    // Se accolto (2) o accolto con segnalazioni (3), scarichiamo la ricevuta PDF
    if (esitoRes.statoElaborazione === "2" || esitoRes.statoElaborazione === "3") {
      const pdfRes = await client.scaricaRicevutaPdf(trasmissione.protocollo);
      if (pdfRes.success && pdfRes.pdfBuffer) {
        pdfBytes = pdfRes.pdfBuffer;
      }
    }

    // Scarica report anomalie/errori se presenti segnalazioni o scarti
    if (
      esitoRes.statoElaborazione === "3" ||
      esitoRes.statoElaborazione === "4" ||
      esitoRes.statoElaborazione === "5" ||
      (esitoRes.numDocumentiScartati && esitoRes.numDocumentiScartati > 0)
    ) {
      const errRes = await client.scaricaDettaglioErrori(trasmissione.protocollo);
      if (errRes.success && errRes.rawCsv) {
        csvText = errRes.rawCsv;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.trasmissioneTs.update({
        where: { id: trasmissioneId },
        data: {
          statoElaborazione: esitoRes.statoElaborazione,
          codiceEsito: esitoRes.codiceEsito,
          descrizioneEsito: esitoRes.descrizioneEsito,
          numRicevuti: esitoRes.numDocumentiRicevuti,
          numAccolti: esitoRes.numDocumentiAccolti,
          numScartati: esitoRes.numDocumentiScartati,
          ...(pdfBytes ? { pdfRicevuta: new Uint8Array(pdfBytes) } : {}),
          ...(csvText ? { csvErrori: csvText } : {}),
        },
      });

      // Gestione automatica dello stato fatture in base all'esito Sogei:
      const isCancellazione = trasmissione.nomeFile.startsWith("annulla_");
      const fattureCollegate = trasmissione.fatture ?? [];

      if (isCancellazione) {
        const cancelDocIds = fattureCollegate.map((f) => f.id);
        const cancelWhere =
          cancelDocIds.length > 0
            ? {
                id: { in: cancelDocIds },
                id_Utente: userId,
                protocollo_cancellazione_ts: trasmissione.protocollo,
              }
            : {
                id_Utente: userId,
                protocollo_cancellazione_ts: trasmissione.protocollo,
              };

        if (esitoRes.statoElaborazione === "2" || esitoRes.statoElaborazione === "3") {
          // Accolto: la cancellazione è andata a buon fine sul Sistema TS
          await tx.pagamento.updateMany({
            where: cancelWhere,
            data: {
              stato_ts: "ANNULLATA_TS",
            },
          });
        } else if (
          esitoRes.statoElaborazione === "4" ||
          esitoRes.statoElaborazione === "5" ||
          (esitoRes.numDocumentiScartati && esitoRes.numDocumentiScartati > 0)
        ) {
          // Scartato: la cancellazione è fallita su Sistema TS (la fattura resta attiva su TS)
          await tx.pagamento.updateMany({
            where: cancelWhere,
            data: {
              stato_ts: "INVIATA",
            },
          });
        }
      } else if (csvText) {
        const errMap = parseCsvErroriTs(csvText);

        const giaPresentiIds: number[] = [];
        const scartatiIds: number[] = [];

        for (const f of fattureCollegate) {
          const docErrors = getErrorsForInvoice(errMap, f);
          if (docErrors.some((e) => e.codiceErrore === "S017")) {
            // 1. Fatture con codice S017 (IDENTIFICATIVO DOCUMENTO FISCALE GIA' PRESENTE):
            // Significa che la spesa è già stata acquisita e registrata con successo su Sistema TS.
            // Non va rimessa in DA_INVIARE (verrebbe sempre rifiutata), ma impostata su INVIATA.
            giaPresentiIds.push(f.id);
          } else if (
            docErrors.some((e) => e.tipo === "ERRORE" && e.codiceErrore !== "S017")
          ) {
            // 2. Altre fatture scartate per anomalie di compilazione (es. S050, CF non valido, ecc.):
            // Sogei non le ha acquisite; vanno rimesse in DA_INVIARE per consentire la correzione.
            scartatiIds.push(f.id);
          }
        }

        if (giaPresentiIds.length > 0) {
          await tx.pagamento.updateMany({
            where: {
              id: { in: giaPresentiIds },
              id_Utente: userId,
              protocollo_ts: trasmissione.protocollo,
            },
            data: {
              stato_ts: "INVIATA",
            },
          });
        }

        if (scartatiIds.length > 0) {
          await tx.pagamento.updateMany({
            where: {
              id: { in: scartatiIds },
              id_Utente: userId,
              protocollo_ts: trasmissione.protocollo,
            },
            data: {
              stato_ts: "DA_INVIARE",
              protocollo_ts: null,
              data_invio_ts: null,
            },
          });
        }
      } else if (
        esitoRes.statoElaborazione === "4" ||
        esitoRes.statoElaborazione === "5"
      ) {
        // Scarto a livello di intera trasmissione (es. errore busta XML, PIN non valido):
        // nessun CSV per singolo documento prodotto da Sogei; nessuna fattura del lotto
        // è stata acquisita. Vanno tutte reimpostate a DA_INVIARE per consentire il reinvio.
        const allDocIds = fattureCollegate.map((f) => f.id);
        if (allDocIds.length > 0) {
          await tx.pagamento.updateMany({
            where: {
              id: { in: allDocIds },
              id_Utente: userId,
              protocollo_ts: trasmissione.protocollo,
            },
            data: {
              stato_ts: "DA_INVIARE",
              protocollo_ts: null,
              data_invio_ts: null,
            },
          });
        }
      }
    });

    return {
      success: true,
      protocollo: trasmissione.protocollo,
      statoElaborazione: esitoRes.statoElaborazione,
      descrizioneEsito: esitoRes.descrizioneEsito,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("sincronizzaEsitoTrasmissione error", error);
    return { success: false, error: `Errore durante la sincronizzazione dell'esito: ${msg}` };
  }
}
