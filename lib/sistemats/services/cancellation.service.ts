import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
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
      // CR-10: presente solo per lo sblocco confermato di un invio con esito
      // incerto, che rilascia tutte le fatture dello stesso lotto.
      esitoIncertoConfermato?: boolean;
      numFatture: number;
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

  // CR-07: lock dedicato all'annullamento. La fattura resta INVIATA o
  // DA_CANCELLARE_SU_TS (stati già protetti da modifica e cancellazione) e
  // data_invio_ts, la data dell'invio originale, non viene toccata. Un lock più
  // vecchio di STALE_LOCK_MINUTES non ha più una chiamata in volo, perché
  // inviaFile dura al massimo MAX_DURATA_INVIO_MS (CR-11), e viene superato.
  const lockTimestamp = new Date();
  const staleThreshold = new Date(lockTimestamp.getTime() - STALE_LOCK_MINUTES * 60 * 1000);
  const lockResult = await prisma.pagamento.updateMany({
    where: {
      id: invoiceId,
      id_Utente: userId,
      stato_ts: { in: ["INVIATA", "DA_CANCELLARE_SU_TS"] },
      OR: [
        { annullamento_avviato_ts: null },
        { annullamento_avviato_ts: { lt: staleThreshold } },
      ],
    },
    data: { annullamento_avviato_ts: lockTimestamp },
  });

  if (!lockResult || lockResult.count === 0) {
    return {
      success: false,
      error: "È già in corso un annullamento per questa fattura. Attendi il completamento e ricarica la pagina.",
    };
  }

  // Ogni uscita rilascia solo il proprio lock: se è scaduto ed è stato ripreso
  // da un'altra richiesta, la where non trova la riga e non tocca nulla.
  const rilasciaLock = (data: Prisma.PagamentoUpdateManyMutationInput = {}) =>
    prisma.pagamento.updateMany({
      where: { id: invoiceId, id_Utente: userId, annullamento_avviato_ts: lockTimestamp },
      data: { ...data, annullamento_avviato_ts: null },
    });

  let clientInfo;
  try {
    clientInfo = await getClientForUser(userId);
  } catch (err) {
    await rilasciaLock();
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

        await tx.pagamento.updateMany({
          where: { id: invoiceId, id_Utente: userId, annullamento_avviato_ts: lockTimestamp },
          data: {
            stato_ts: "DA_CANCELLARE_SU_TS",
            protocollo_cancellazione_ts: protocollo,
            annullamento_avviato_ts: null,
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
      await rilasciaLock({ stato_ts: "DA_CANCELLARE_SU_TS" });

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
    await rilasciaLock({ stato_ts: "DA_CANCELLARE_SU_TS" });

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
  // CR-10: l'utente dichiara di aver verificato sul portale Sistema TS che il
  // lotto con esito incerto non è stato acquisito.
  confermaEsitoVerificato?: boolean;
}): Promise<ReissueResult> {
  const { userId, invoiceId, confermaEsitoVerificato = false } = params;

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
  // valorizzato è un lotto acquisito da Sogei ma non registrato (CR-02; dopo
  // CR-07 l'annullamento non usa più IN_TRASMISSIONE): riportarla in
  // DA_INVIARE la farebbe reinviare in duplicato e perderebbe il protocollo.
  // Con un lock recente la chiamata a Sogei può essere ancora in volo.
  const staleThreshold = new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1000);
  if (invoice.stato_ts === "IN_TRASMISSIONE") {
    if (invoice.protocollo_ts) {
      return {
        success: false,
        error:
          `Il Sistema TS ha acquisito questa fattura (protocollo ${invoice.protocollo_ts}), ma l'invio non è stato registrato nel gestionale: ` +
          "non può tornare in 'Da Inviare'. Contatta l'assistenza indicando il protocollo.",
      };
    }
    if (!invoice.data_invio_ts || invoice.data_invio_ts >= staleThreshold) {
      return {
        success: false,
        error: "Trasmissione in corso: riprova tra qualche minuto.",
      };
    }
    // CR-10: la chiamata a Sogei è partita senza un esito certo. Si sblocca
    // solo su conferma esplicita, e l'intero lotto insieme.
    if (invoice.invio_avviato_ts) {
      if (invoice.invio_avviato_ts >= staleThreshold) {
        return {
          success: false,
          error: "Trasmissione in corso: riprova tra qualche minuto.",
        };
      }
      if (!confermaEsitoVerificato) {
        return {
          success: false,
          error:
            "Esito dell'invio incerto: verifica sul portale Sistema TS che il lotto non sia stato acquisito, poi conferma lo sblocco.",
        };
      }

      const lotto = await prisma.pagamento.updateMany({
        where: {
          id_Utente: userId,
          stato_ts: "IN_TRASMISSIONE",
          protocollo_ts: null,
          data_invio_ts: invoice.data_invio_ts,
          invio_avviato_ts: { lt: staleThreshold },
        },
        data: {
          stato_ts: "DA_INVIARE",
          protocollo_ts: null,
          data_invio_ts: null,
          invio_avviato_ts: null,
        },
      });

      if (lotto.count === 0) {
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
        esitoIncertoConfermato: true,
        numFatture: lotto.count,
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
            invio_avviato_ts: null,
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
    numFatture: result.count,
  };
}
