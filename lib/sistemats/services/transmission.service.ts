import { prisma } from "@/lib/prisma";
import { buildSistemaTsXml, createZipArchive } from "@/lib/sistemats/xml-builder";
import { validateCodiceFiscale } from "@/lib/sistemats/cf-validator";
import { resolveAnagrafica } from "@/lib/invoices/anagrafica-snapshot";
import { buildVociSpesa, validateImportoSpesa } from "@/lib/sistemats/payload-builder";
import { isDataPagamentoFutura, formatDateDisplay } from "@/lib/utils/date";
import { isBolloDovuto, isBolloCodiceValido } from "@/lib/fiscal/bollo";
import { isUniqueViolationOnField } from "@/lib/prisma-errors";
import { getClientForUser } from "./client.service";
import type {
  DocumentoSpesaPayload,
  SpesaSanitariaPayload,
} from "@/lib/sistemats/types";

// Oltre questa età un lock IN_TRASMISSIONE è considerato orfano: supera con
// margine il timeout massimo di una chiamata a Sogei (120s).
export const STALE_LOCK_MINUTES = 5;

export class ConcurrencyLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConcurrencyLockError";
  }
}

export type TransmissionResult =
  | {
      success: true;
      protocollo: string;
      invoicesCount: number;
      invoicesLabels: string[];
    }
  | {
      success: false;
      error: string;
    };

/**
 * DRY-05: Centralizza il ripristino dello stato delle fatture da IN_TRASMISSIONE a DA_INVIARE,
 * rilasciando il lock temporaneo in caso di errori di validazione, scarto Sogei o eccezioni runtime.
 */
export async function rollbackStatoTrasmissione(
  candidateIds: number[],
  userId: number,
  lockTimestamp?: Date
): Promise<void> {
  if (candidateIds.length === 0) return;

  await prisma.pagamento.updateMany({
    where: {
      id: { in: candidateIds },
      id_Utente: userId,
      stato_ts: "IN_TRASMISSIONE",
      ...(lockTimestamp ? { data_invio_ts: lockTimestamp } : {}),
    },
    data: {
      stato_ts: "DA_INVIARE",
      data_invio_ts: null,
    },
  });
}

/**
 * CR-02: Sogei ha acquisito il lotto ma la registrazione nel DB è fallita.
 * Niente rollback: le fatture restano IN_TRASMISSIONE. Si prova a scrivere
 * almeno protocollo_ts, così il recupero dei lock orfani (che agisce solo con
 * protocollo_ts nullo) non le rimette in DA_INVIARE. Il protocollo finisce
 * comunque nel log e nel messaggio all'utente.
 */
async function gestisciProtocolloNonRegistrato(params: {
  protocollo: string;
  fileName: string;
  candidateIds: number[];
  userId: number;
  lockTimestamp: Date;
  error: unknown;
}): Promise<TransmissionResult> {
  const { protocollo, fileName, candidateIds, userId, lockTimestamp, error } = params;

  try {
    await prisma.pagamento.updateMany({
      where: {
        id: { in: candidateIds },
        id_Utente: userId,
        stato_ts: "IN_TRASMISSIONE",
        data_invio_ts: lockTimestamp,
      },
      data: { protocollo_ts: protocollo },
    });
  } catch (fallbackError) {
    // ponytail: se il DB è del tutto irraggiungibile il protocollo sopravvive
    // solo nel log e nel messaggio all'utente; serve un archivio di recupero
    // esterno al DB se questo caso diventa frequente.
    console.error("Salvataggio di ripiego del protocollo fallito:", fallbackError);
  }

  // Prefisso grep-abile, stesso schema di AUDIT_WRITE_FAILED (lib/audit/log.ts).
  console.error(
    "TS_PROTOCOLLO_NON_REGISTRATO",
    { protocollo, fileName, invoiceIds: candidateIds },
    error
  );

  return {
    success: false,
    error:
      `Il Sistema TS ha acquisito il lotto (protocollo ${protocollo}), ma il salvataggio nel gestionale non è riuscito. ` +
      "NON reinviare queste fatture: annota il protocollo e contatta l'assistenza.",
  };
}

export async function inviaLottoFattureService(params: {
  userId: number;
  invoiceIds: number[];
}): Promise<TransmissionResult> {
  const { userId, invoiceIds } = params;

  const uniqueIds = Array.from(new Set(invoiceIds));
  if (!uniqueIds || uniqueIds.length === 0) {
    return { success: false, error: "Nessuna fattura selezionata per l'invio." };
  }

  let clientInfo;
  try {
    clientInfo = await getClientForUser(userId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  const { client, proprietario, user } = clientInfo;

  // Recupero automatico self-healing per lock orfani rimasti in IN_TRASMISSIONE
  // oltre il timeout massimo di chiamata a Sogei (120s). Finestra di sicurezza: 5 minuti.
  // Limita il recupero a DA_INVIARE solo agli invii iniziali (protocollo_ts nullo).
  const staleThreshold = new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1000);
  await prisma.pagamento.updateMany({
    where: {
      id_Utente: userId,
      stato_ts: "IN_TRASMISSIONE",
      protocollo_ts: null,
      data_invio_ts: { lt: staleThreshold },
    },
    data: {
      stato_ts: "DA_INVIARE",
      data_invio_ts: null,
    },
  });

  const lockTimestamp = new Date();
  let invoices;

  try {
    // Fase 1: Lock atomico transazionale e fetch immediata dello stato più recente
    invoices = await prisma.$transaction(async (tx) => {
      // 1. Lock atomico diretto sulle fatture richieste in stato DA_INVIARE
      const lockResult = await tx.pagamento.updateMany({
        where: {
          id: { in: uniqueIds },
          id_Utente: userId,
          stato_ts: "DA_INVIARE",
        },
        data: {
          stato_ts: "IN_TRASMISSIONE",
          data_invio_ts: lockTimestamp,
          protocollo_ts: null,
        },
      });

      // Se il conteggio non corrisponde esattamente al numero di fatture richieste,
      // significa che una o più fatture non esistono, appartengono a un altro utente,
      // sono già in trasmissione o sono già state inviate/annullate.
      if (lockResult.count !== uniqueIds.length) {
        throw new ConcurrencyLockError(
          "Una o più fatture selezionate sono già in fase di trasmissione o non sono più nello stato 'Da Inviare'. Riprova tra poco."
        );
      }

      // 2. Fetch delle fatture appena bloccate con i dati più recenti
      const lockedInvoices = await tx.pagamento.findMany({
        where: {
          id: { in: uniqueIds },
          id_Utente: userId,
          stato_ts: "IN_TRASMISSIONE",
          data_invio_ts: lockTimestamp,
        },
        include: {
          pagante: true,
          paziente: true,
        },
        orderBy: [{ anno: "asc" }, { n_fattura: "asc" }],
      });

      return lockedInvoices;
    });
  } catch (error) {
    if (error instanceof ConcurrencyLockError) {
      return { success: false, error: error.message };
    }
    throw error;
  }

  if (invoices.length === 0) {
    return { success: false, error: "Nessuna fattura idonea trovata tra quelle selezionate." };
  }

  const candidateIds = invoices.map((i) => i.id);

  // Pre-validazione Codici Fiscali e dati fattura
  const documenti: DocumentoSpesaPayload[] = [];
  for (const inv of invoices) {
    const anagrafica = resolveAnagrafica(inv);
    const cf = anagrafica.pagante.cf?.trim() ?? "";
    // Pre-validazione Codice Fiscale (se non c'è opposizione dell'assistito)
    if (!inv.flag_opposizione) {
      const cfValidation = validateCodiceFiscale(cf);
      if (!cfValidation.valid) {
        // Rollback delle fatture bloccate se la validazione fallisce
        await rollbackStatoTrasmissione(candidateIds, userId, lockTimestamp);
        return {
          success: false,
          error: `Fattura n. ${inv.n_fattura}/${inv.anno}: Codice Fiscale Pagante ('${cf || "mancante"}') non valido: ${cfValidation.error}`,
        };
      }
    }

    const prezzoTotale = inv.prezzo_totale.toNumber();
    const importoValidation = validateImportoSpesa(prezzoTotale);
    if (!importoValidation.valid) {
      // Rollback delle fatture bloccate se la validazione dell'importo fallisce
      await rollbackStatoTrasmissione(candidateIds, userId, lockTimestamp);
      return {
        success: false,
        error: `Fattura n. ${inv.n_fattura}/${inv.anno}: ${importoValidation.error}`,
      };
    }

    const dataEffettiva = inv.data_pagamento ?? inv.data;
    if (isDataPagamentoFutura(inv.data_pagamento, inv.data)) {
      // Rollback delle fatture bloccate se la data di pagamento è futura
      await rollbackStatoTrasmissione(candidateIds, userId, lockTimestamp);
      return {
        success: false,
        error: `Fattura n. ${inv.n_fattura}/${inv.anno}: La data di incasso (${formatDateDisplay(dataEffettiva)}) è futura rispetto alla data odierna. Non è possibile trasmetterla prima di tale data (vincolo ministeriale DM 19/10/2020, errore Sogei S036).`,
      };
    }

    // ARCH-06 / SMELL-10: Se la fattura supera la soglia di legge (77.47 €),
    // deve obbligatoriamente avere un codice marca da bollo valido per essere trasmessa a Sistema TS.
    if (isBolloDovuto(prezzoTotale) && !isBolloCodiceValido(inv.bolloCodice)) {
      await rollbackStatoTrasmissione(candidateIds, userId, lockTimestamp);
      return {
        success: false,
        error: `Fattura n. ${inv.n_fattura}/${inv.anno}: L'importo (${prezzoTotale.toFixed(2)} €) supera la soglia di 77,47 € ed è privo di codice marca da bollo valido. Inserire il codice prima dell'invio.`,
      };
    }

    const vociSpesa = buildVociSpesa({
      prezzoTotale,
      naturaIva: inv.natura_iva,
      bolloCodice: inv.bolloCodice,
    });

    documenti.push({
      idSpesa: {
        pIva: user.pIva,
        dataEmissione: inv.data,
        numDocumento: String(inv.n_fattura),
        dispositivo: 1,
      },
      dataPagamento: inv.data_pagamento ?? inv.data,
      flagOperazione: "I",
      cfCittadino: inv.flag_opposizione ? "" : cf,
      pagamentoTracciato: inv.pagamento_tracciato ? "SI" : "NO",
      tipoDocumento: "F",
      flagOpposizione: inv.flag_opposizione ? 1 : 0,
      vociSpesa,
    });
  }

  const payload: SpesaSanitariaPayload = {
    proprietario,
    documenti,
  };

  // CR-02: valorizzato appena Sogei restituisce il protocollo. Da quel momento
  // il lotto è acquisito dal Sistema TS e nessun percorso deve più riportare
  // le fatture a DA_INVIARE: un reinvio creerebbe un lotto duplicato.
  let protocolloAcquisito: string | null = null;
  const timestampStr = lockTimestamp.toISOString().replace(/[-:T.]/g, "").slice(0, 14);
  const fileName = `invio_${timestampStr}.zip`;
  try {
    const xmlString = buildSistemaTsXml(payload);
    const zipBytes = await createZipArchive(xmlString, "730.xml");

    const res = await client.inviaFile(zipBytes, fileName);

    if (!res.success || !res.protocollo) {
      // Revert dello stato a DA_INVIARE se la trasmissione è stata respinta
      await rollbackStatoTrasmissione(candidateIds, userId, lockTimestamp);

      if (res.esitoIncerto) {
        return {
          success: false,
          error:
            "Esito della trasmissione incerto: il Sistema TS potrebbe aver ricevuto il file. " +
            "Prima di reinviare, verifica sul portale Sistema TS che il lotto non risulti già acquisito." +
            (res.errorMessage ? ` (${res.errorMessage})` : ""),
        };
      }

      return {
        success: false,
        error:
          res.errorMessage ||
          res.descrizioneEsito ||
          "Trasmissione respinta dal Sistema TS.",
      };
    }

    const protocollo = res.protocollo;
    protocolloAcquisito = protocollo;
    const now = new Date();

    // Registra trasmissione e aggiorna stato delle fatture da IN_TRASMISSIONE a INVIATA
    const registraTrasmissione = () => prisma.$transaction(async (tx) => {
      await tx.trasmissioneTs.create({
        data: {
          id_Utente: userId,
          protocollo,
          nomeFile: fileName,
          dataInvio: now,
          statoElaborazione: "0", // In elaborazione
          codiceEsito: res.codiceEsito,
          descrizioneEsito: res.descrizioneEsito || "Trasmissione inviata con successo",
          numRicevuti: invoices.length,
          fatture: {
            connect: candidateIds.map((id) => ({ id })),
          },
        },
      });

      await tx.pagamento.updateMany({
        where: {
          id: { in: candidateIds },
          id_Utente: userId,
          stato_ts: "IN_TRASMISSIONE",
        },
        data: {
          stato_ts: "INVIATA",
          protocollo_ts: protocollo,
          data_invio_ts: now,
        },
      });
    });

    // Un secondo tentativo copre gli errori transitori del DB. Una violazione
    // di unicità su `protocollo` al secondo tentativo significa che il primo
    // era stato salvato nonostante l'errore (es. connessione caduta dopo il
    // commit): la trasmissione risulta già registrata.
    try {
      await registraTrasmissione();
    } catch (firstError) {
      try {
        await registraTrasmissione();
      } catch (secondError) {
        if (
          isUniqueViolationOnField(firstError, "protocollo") ||
          !isUniqueViolationOnField(secondError, "protocollo")
        ) {
          throw secondError;
        }
      }
    }

    return {
      success: true,
      protocollo,
      invoicesCount: invoices.length,
      invoicesLabels: invoices.map((i) => `${i.n_fattura}/${i.anno}`),
    };
  } catch (error) {
    if (protocolloAcquisito) {
      return gestisciProtocolloNonRegistrato({
        protocollo: protocolloAcquisito,
        fileName,
        candidateIds,
        userId,
        lockTimestamp,
        error,
      });
    }
    try {
      await rollbackStatoTrasmissione(candidateIds, userId, lockTimestamp);
    } catch (rollbackError) {
      console.error("Errore durante il rollback dello stato di trasmissione:", rollbackError);
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("inviaLottoFatture error", error);
    return { success: false, error: `Errore durante la preparazione o trasmissione del lotto: ${msg}` };
  }
}
