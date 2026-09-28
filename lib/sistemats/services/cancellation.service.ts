import { prisma } from "@/lib/prisma";
import { buildSistemaTsXml, createZipArchive } from "@/lib/sistemats/xml-builder";
import { resolveAnagrafica } from "@/lib/invoices/anagrafica-snapshot";
import { buildVociSpesa } from "@/lib/sistemats/payload-builder";
import { getClientForUser } from "./client.service";
import { STALE_LOCK_MINUTES } from "@/lib/sistemats/lock-timing";
import type {
  DocumentoSpesaPayload,
  SpesaSanitariaPayload,
} from "@/lib/sistemats/types";

export type CancellationResult =
  | {
      success: true;
      protocollo: string;
      invoice: { n_fattura: number; anno: number };
    }
  | {
      success: false;
      error: string;
      fallback?: boolean;
    };

export type ReissueResult =
  | {
      success: true;
      invoice: { n_fattura: number; anno: number; statoPrecedente: string };
    }
  | {
      success: false;
      error: string;
    };

export async function annullaFatturaTsService(params: {
  userId: number;
  invoiceId: number;
}): Promise<CancellationResult> {
  const { userId, invoiceId } = params;

  // Recupero automatico self-healing per lock orfani di cancellazione rimasti in IN_TRASMISSIONE
  // oltre il timeout massimo di chiamata a Sogei (120s). Finestra di sicurezza: 5 minuti.
  const staleThreshold = new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1000);
  await prisma.pagamento.updateMany({
    where: {
      id: invoiceId,
      id_Utente: userId,
      stato_ts: "IN_TRASMISSIONE",
      protocollo_ts: { not: null },
      data_invio_ts: { lt: staleThreshold },
    },
    data: {
      stato_ts: "DA_CANCELLARE_SU_TS",
    },
  });

  const invoice = await prisma.pagamento.findFirst({
    where: { id: invoiceId, id_Utente: userId },
    include: { pagante: true, paziente: true },
  });

  if (!invoice) {
    return { success: false, error: "Fattura non trovata." };
  }

  if (invoice.stato_ts === "IN_TRASMISSIONE") {
    return {
      success: false,
      error: "La fattura è attualmente in fase di trasmissione. Attendi il completamento prima di annullarla.",
    };
  }

  if (invoice.stato_ts === "DA_INVIARE") {
    return {
      success: false,
      error: "Non è possibile annullare sul Sistema TS una fattura che non è mai stata trasmessa (stato 'Da Inviare').",
    };
  }

  if (invoice.stato_ts === "ANNULLATA_TS") {
    return {
      success: false,
      error: "La fattura risulta già annullata sul Sistema TS.",
    };
  }

  if (invoice.stato_ts !== "INVIATA" && invoice.stato_ts !== "DA_CANCELLARE_SU_TS") {
    return {
      success: false,
      error: "Solo le fatture inviate o in attesa di cancellazione possono essere annullate sul Sistema TS.",
    };
  }

  // Lock atomico preventivo: blocca la fattura in IN_TRASMISSIONE prima della chiamata di rete verso Sogei
  const lockTimestamp = new Date();
  const lockResult = await prisma.pagamento.updateMany({
    where: {
      id: invoiceId,
      id_Utente: userId,
      stato_ts: { in: ["INVIATA", "DA_CANCELLARE_SU_TS"] },
    },
    data: {
      stato_ts: "IN_TRASMISSIONE",
      data_invio_ts: lockTimestamp,
    },
  });

  if (!lockResult || lockResult.count === 0) {
    return {
      success: false,
      error: "La fattura è attualmente in fase di trasmissione. Attendi il completamento prima di annullarla.",
    };
  }

  let clientInfo;
  try {
    clientInfo = await getClientForUser(userId);
  } catch (err) {
    await prisma.pagamento.update({
      where: { id: invoiceId },
      data: {
        stato_ts: invoice.stato_ts,
      },
    });
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  const { client, proprietario, user } = clientInfo;
  const anagrafica = resolveAnagrafica(invoice);
  const cf = anagrafica.pagante.cf?.trim() ?? "";

  const cfCittadino = invoice.flag_opposizione ? "" : cf;
  const prezzoTotale = invoice.prezzo_totale.toNumber();
  const vociSpesa = buildVociSpesa({
    prezzoTotale,
    naturaIva: invoice.natura_iva,
    bolloCodice: invoice.bolloCodice,
  });

  const docCancellazione: DocumentoSpesaPayload = {
    idSpesa: {
      pIva: user.pIva,
      dataEmissione: invoice.data,
      numDocumento: String(invoice.n_fattura),
      dispositivo: 1,
    },
    dataPagamento: invoice.data_pagamento ?? invoice.data,
    flagOperazione: "C", // Cancellazione
    cfCittadino,
    pagamentoTracciato: invoice.pagamento_tracciato ? "SI" : "NO",
    tipoDocumento: "F",
    flagOpposizione: invoice.flag_opposizione ? 1 : 0,
    vociSpesa,
  };

  const payload: SpesaSanitariaPayload = {
    proprietario,
    documenti: [docCancellazione],
  };

  try {
    const xmlString = buildSistemaTsXml(payload);
    const zipBytes = await createZipArchive(xmlString, "730.xml");
    const res = await client.inviaFile(zipBytes, `annulla_${invoice.n_fattura}.zip`);

    if (res.success && res.protocollo) {
      const now = new Date();
      const protocollo = res.protocollo;
      const fileName = `annulla_${invoice.n_fattura}.zip`;

      await prisma.$transaction(async (tx) => {
        await tx.trasmissioneTs.create({
          data: {
            id_Utente: userId,
            protocollo,
            nomeFile: fileName,
            dataInvio: now,
            statoElaborazione: "0", // In elaborazione
            codiceEsito: res.codiceEsito,
            descrizioneEsito:
              res.descrizioneEsito || "Richiesta di annullamento inviata con successo",
            numRicevuti: 1,
            fatture: {
              connect: [{ id: invoiceId }],
            },
          },
        });

        await tx.pagamento.update({
          where: { id: invoiceId },
          data: {
            stato_ts: "DA_CANCELLARE_SU_TS",
            protocollo_cancellazione_ts: protocollo,
          },
        });
      });

      return {
        success: true,
        protocollo,
        invoice: {
          n_fattura: invoice.n_fattura,
          anno: invoice.anno,
        },
      };
    } else {
      // Errore di connessione o scarto MEF: contrassegna come DA_CANCELLARE_SU_TS
      await prisma.pagamento.update({
        where: { id: invoiceId },
        data: {
          stato_ts: "DA_CANCELLARE_SU_TS",
        },
      });

      return {
        success: false,
        error:
          res.errorMessage ||
          "Impossibile contattare Sistema TS al momento. La fattura è stata impostata come 'DA CANCELLARE SU TS' e potrà essere ritrasmessa dalla schermata Sistema TS.",
        fallback: true,
      };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("annullaFatturaTs network error", error);
    await prisma.pagamento.update({
      where: { id: invoiceId },
      data: {
        stato_ts: "DA_CANCELLARE_SU_TS",
      },
    });

    return {
      success: false,
      error:
        `Errore di connessione (${msg}). La fattura è stata contrassegnata come 'DA CANCELLARE SU TS'.`,
      fallback: true,
    };
  }
}

export async function ripristinaFatturaPerReinvioService(params: {
  userId: number;
  invoiceId: number;
}): Promise<ReissueResult> {
  const { userId, invoiceId } = params;

  const invoice = await prisma.pagamento.findFirst({
    where: { id: invoiceId, id_Utente: userId },
  });

  if (!invoice) {
    return { success: false, error: "Fattura non trovata." };
  }

  // Non è consentito riportare la fattura in DA_INVIARE se non è stata prima annullata con successo su Sistema TS
  // o se non è rimasta bloccata in trasmissione
  if (invoice.stato_ts !== "ANNULLATA_TS" && invoice.stato_ts !== "IN_TRASMISSIONE") {
    return {
      success: false,
      error:
        "Non è possibile cambiare lo stato della fattura in 'Da Inviare' se non è stata prima annullata sul Sistema TS o bloccata in trasmissione.",
    };
  }

  // CR-03: una fattura IN_TRASMISSIONE si può sbloccare solo se è un invio
  // iniziale (protocollo_ts nullo) il cui lock è ormai orfano. Con protocollo
  // valorizzato è già sul Sistema TS (annullamento in corso, oppure lotto
  // acquisito ma non registrato — CR-02): riportarla in DA_INVIARE la farebbe
  // reinviare in duplicato e perderebbe il protocollo. Con un lock recente la
  // chiamata a Sogei può essere ancora in volo.
  const staleThreshold = new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1000);
  if (invoice.stato_ts === "IN_TRASMISSIONE") {
    if (invoice.protocollo_ts) {
      return {
        success: false,
        error:
          `La fattura risulta già trasmessa al Sistema TS (protocollo ${invoice.protocollo_ts}) o è in corso un annullamento: ` +
          "non può tornare in 'Da Inviare'. Contatta l'assistenza indicando il protocollo.",
      };
    }
    if (!invoice.data_invio_ts || invoice.data_invio_ts >= staleThreshold) {
      return {
        success: false,
        error: "Trasmissione in corso: riprova tra qualche minuto.",
      };
    }
  }

  // Scrittura condizionata: se lo stato è cambiato tra la lettura e qui
  // (invio o sincronizzazione concorrente) non si tocca nulla.
  const result = await prisma.pagamento.updateMany({
    where:
      invoice.stato_ts === "IN_TRASMISSIONE"
        ? {
            id: invoiceId,
            id_Utente: userId,
            stato_ts: "IN_TRASMISSIONE",
            protocollo_ts: null,
            data_invio_ts: { lt: staleThreshold },
          }
        : { id: invoiceId, id_Utente: userId, stato_ts: "ANNULLATA_TS" },
    data: {
      stato_ts: "DA_INVIARE",
      protocollo_ts: null,
      data_invio_ts: null,
    },
  });

  if (result.count === 0) {
    return {
      success: false,
      error: "Lo stato della fattura è cambiato nel frattempo: ricarica la pagina.",
    };
  }

  return {
    success: true,
    invoice: {
      n_fattura: invoice.n_fattura,
      anno: invoice.anno,
      statoPrecedente: invoice.stato_ts,
    },
  };
}
