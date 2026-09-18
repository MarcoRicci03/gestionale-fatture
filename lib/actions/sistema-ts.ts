"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit/log";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { getClientIp } from "@/lib/auth/client-ip";
import { decryptCredential, encryptCredential } from "@/lib/sistemats/vault";
import { SistemaTsClient } from "@/lib/sistemats/client";
import { buildSistemaTsXml, createZipArchive } from "@/lib/sistemats/xml-builder";
import { validateCodiceFiscale } from "@/lib/sistemats/cf-validator";
import { getErrorsForInvoice, parseCsvErroriTs } from "@/lib/sistemats/csv-parser";
import { resolveAnagrafica } from "@/lib/invoices/anagrafica-snapshot";
import { buildVociSpesa, validateImportoSpesa } from "@/lib/sistemats/payload-builder";
import {
  sistemaTsTransmissionLimiter,
  sistemaTsSyncLimiter,
} from "@/lib/sistemats/rate-limiters";
import {
  sistemaTsSettingsSchema,
  type SistemaTsSettingsInput,
} from "@/lib/validations/sistema-ts";
import {
  correggiFatturaTsSchema,
  type CorreggiFatturaTsInput,
} from "@/lib/validations/sistema-ts-correction";
import { isUniqueViolationOnField } from "@/lib/prisma-errors";
import { Prisma } from "@prisma/client";
import { isDataPagamentoFutura, formatDateDisplay } from "@/lib/utils/date";
import type {
  DocumentoSpesaPayload,
  ProprietarioPayload,
  SpesaSanitariaPayload,
} from "@/lib/sistemats/types";

export type SistemaTsActionState =
  | { success: true; protocollo?: string; message?: string }
  | { error: string; fallback?: boolean };

/**
 * Salva o aggiorna le credenziali e impostazioni del Sistema TS per l'utente corrente.
 */
export async function saveSistemaTsSettings(
  input: SistemaTsSettingsInput
): Promise<SistemaTsActionState> {
  const userId = await requireUserId();

  const parsed = sistemaTsSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Dati non validi" };
  }

  const data = parsed.data;
  const existing = await prisma.impostazioniSistemaTs.findUnique({
    where: { id_Utente: userId },
  });

  let passwordEncrypted = existing?.passwordEncrypted ?? "";
  if (data.password && data.password.trim() !== "") {
    passwordEncrypted = encryptCredential(data.password.trim());
  }

  let pincodeEncrypted = existing?.pincodeEncrypted ?? "";
  if (data.pincode && data.pincode.trim() !== "") {
    pincodeEncrypted = encryptCredential(data.pincode.trim());
  }

  if (!passwordEncrypted) {
    return { error: "La password del Sistema TS è obbligatoria." };
  }
  if (!pincodeEncrypted) {
    return { error: "Il PinCode del Sistema TS è obbligatorio." };
  }

  try {
    await prisma.impostazioniSistemaTs.upsert({
      where: { id_Utente: userId },
      create: {
        id_Utente: userId,
        username: data.username.trim(),
        passwordEncrypted,
        pincodeEncrypted,
        codiceRegione: data.codiceRegione,
        codiceAsl: data.codiceAsl,
        codiceStruttura: data.codiceStruttura,
        naturaIvaDefault: data.naturaIvaDefault,
      },
      update: {
        username: data.username.trim(),
        passwordEncrypted,
        pincodeEncrypted,
        codiceRegione: data.codiceRegione,
        codiceAsl: data.codiceAsl,
        codiceStruttura: data.codiceStruttura,
        naturaIvaDefault: data.naturaIvaDefault,
      },
    });

    await logAudit({
      azione: AUDIT_ACTIONS.SISTEMA_TS_SETTINGS_UPDATE,
      userId,
      entita: "ImpostazioniSistemaTs",
      ip: await getClientIp(),
    });

    revalidatePath("/settings/sistema-ts");
    revalidatePath("/sistema-ts");
    return { success: true, message: "Impostazioni Sistema TS salvate con successo." };
  } catch (error) {
    console.error("saveSistemaTsSettings error", error);
    return { error: "Errore durante il salvataggio delle impostazioni Sistema TS." };
  }
}

async function getClientForUser(userId: number): Promise<{
  client: SistemaTsClient;
  proprietario: ProprietarioPayload;
  user: { cf: string; pIva: string };
}> {
  const [settings, user] = await Promise.all([
    prisma.impostazioniSistemaTs.findUnique({ where: { id_Utente: userId } }),
    prisma.utente.findUnique({ where: { id: userId } }),
  ]);

  if (!settings || !settings.passwordEncrypted || !settings.pincodeEncrypted) {
    throw new Error(
      "Credenziali Sistema TS non configurate. Accedi a 'Impostazioni Sistema TS' per inserire Username, Password e PinCode."
    );
  }

  if (!user?.pIva || !user?.cf) {
    throw new Error(
      "Profilo utente incompleto: Codice Fiscale e Partita IVA sono obbligatori per l'invio TS. Aggiorna il tuo Account."
    );
  }

  const passwordDecrypted = decryptCredential(settings.passwordEncrypted);
  const pincodeDecrypted = decryptCredential(settings.pincodeEncrypted);

  const proprietario: ProprietarioPayload = {
    codiceRegione: settings.codiceRegione,
    codiceAsl: settings.codiceAsl,
    codiceStruttura: settings.codiceStruttura,
    cfProprietario: user.cf,
  };

  const client = new SistemaTsClient({
    username: settings.username,
    passwordDecrypted,
    pincodeDecrypted,
    codiceRegione: settings.codiceRegione,
    codiceAsl: settings.codiceAsl,
    codiceStruttura: settings.codiceStruttura,
    cfProprietario: user.cf,
  });

  return {
    client,
    proprietario,
    user: { cf: user.cf, pIva: user.pIva },
  };
}

class ConcurrencyLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConcurrencyLockError";
  }
}

/**
 * Trasmette un lotto di fatture selezionate al Sistema TS in formato SOAP MTOM.
 */
export async function inviaLottoFatture(invoiceIds: number[]): Promise<SistemaTsActionState> {
  const userId = await requireUserId();

  const uniqueIds = Array.from(new Set(invoiceIds));
  if (!uniqueIds || uniqueIds.length === 0) {
    return { error: "Nessuna fattura selezionata per l'invio." };
  }

  const rateLimit = sistemaTsTransmissionLimiter.consume(String(userId));
  if (!rateLimit.allowed) {
    const retryAfter = rateLimit.retryAfterSeconds ?? 1;
    return {
      error: `Troppe richieste di trasmissione inviate. Per proteggere la connessione con il Sistema TS, attendi ${retryAfter} secondi prima di riprovare.`,
    };
  }

  let clientInfo;
  try {
    clientInfo = await getClientForUser(userId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  const { client, proprietario, user } = clientInfo;

  // ponytail: recupero automatico self-healing per lock orfani rimasti in IN_TRASMISSIONE
  // oltre il timeout massimo di chiamata a Sogei (120s). Finestra di sicurezza: 5 minuti.
  // Limita il recupero a DA_INVIARE solo agli invii iniziali (protocollo_ts nullo).
  const STALE_LOCK_MINUTES = 5;
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
      return { error: error.message };
    }
    throw error;
  }

  if (invoices.length === 0) {
    return { error: "Nessuna fattura idonea trovata tra quelle selezionate." };
  }

  const candidateIds = invoices.map((i) => i.id);

  // Pre-validazione Codici Fiscali
  const documenti: DocumentoSpesaPayload[] = [];
  for (const inv of invoices) {
    const anagrafica = resolveAnagrafica(inv);
    const cf = anagrafica.pagante.cf?.trim() ?? "";
    // Pre-validazione Codice Fiscale (se non c'è opposizione dell'assistito)
    if (!inv.flag_opposizione) {
      const cfValidation = validateCodiceFiscale(cf);
      if (!cfValidation.valid) {
        // Rollback delle fatture bloccate se la validazione fallisce
        await prisma.pagamento.updateMany({
          where: {
            id: { in: candidateIds },
            id_Utente: userId,
            stato_ts: "IN_TRASMISSIONE",
            data_invio_ts: lockTimestamp,
          },
          data: {
            stato_ts: "DA_INVIARE",
            data_invio_ts: null,
          },
        });
        return {
          error: `Fattura n. ${inv.n_fattura}/${inv.anno}: Codice Fiscale Pagante ('${cf || "mancante"}') non valido: ${cfValidation.error}`,
        };
      }
    }

    const prezzoTotale = inv.prezzo_totale.toNumber();
    const importoValidation = validateImportoSpesa(prezzoTotale);
    if (!importoValidation.valid) {
      // Rollback delle fatture bloccate se la validazione dell'importo fallisce
      await prisma.pagamento.updateMany({
        where: {
          id: { in: candidateIds },
          id_Utente: userId,
          stato_ts: "IN_TRASMISSIONE",
          data_invio_ts: lockTimestamp,
        },
        data: {
          stato_ts: "DA_INVIARE",
          data_invio_ts: null,
        },
      });
      return {
        error: `Fattura n. ${inv.n_fattura}/${inv.anno}: ${importoValidation.error}`,
      };
    }

    const dataEffettiva = inv.data_pagamento ?? inv.data;
    if (isDataPagamentoFutura(inv.data_pagamento, inv.data)) {
      // Rollback delle fatture bloccate se la data di pagamento è futura
      await prisma.pagamento.updateMany({
        where: {
          id: { in: candidateIds },
          id_Utente: userId,
          stato_ts: "IN_TRASMISSIONE",
          data_invio_ts: lockTimestamp,
        },
        data: {
          stato_ts: "DA_INVIARE",
          data_invio_ts: null,
        },
      });
      return {
        error: `Fattura n. ${inv.n_fattura}/${inv.anno}: La data di incasso (${formatDateDisplay(dataEffettiva)}) è futura rispetto alla data odierna. Non è possibile trasmetterla prima di tale data (vincolo ministeriale DM 19/10/2020, errore Sogei S036).`,
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

  let transmissionSuccess = false;
  try {
    const xmlString = buildSistemaTsXml(payload);
    const timestampStr = lockTimestamp.toISOString().replace(/[-:T.]/g, "").slice(0, 14);
    const fileName = `invio_${timestampStr}.zip`;
    const zipBytes = await createZipArchive(xmlString, "730.xml");

    const res = await client.inviaFile(zipBytes, fileName);

    if (!res.success || !res.protocollo) {
      // Revert dello stato a DA_INVIARE se la trasmissione è stata respinta
      await prisma.pagamento.updateMany({
        where: {
          id: { in: candidateIds },
          id_Utente: userId,
          stato_ts: "IN_TRASMISSIONE",
        },
        data: {
          stato_ts: "DA_INVIARE",
          data_invio_ts: null,
        },
      });

      return {
        error:
          res.errorMessage ||
          res.descrizioneEsito ||
          "Trasmissione respinta dal Sistema TS.",
      };
    }

    const protocollo = res.protocollo;
    const now = new Date();

    // Registra trasmissione e aggiorna stato delle fatture da IN_TRASMISSIONE a INVIATA
    await prisma.$transaction(async (tx) => {
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

    transmissionSuccess = true;

    await logAudit({
      azione: AUDIT_ACTIONS.SISTEMA_TS_SEND,
      userId,
      entita: "TrasmissioneTs",
      ip: await getClientIp(),
      meta: {
        protocollo,
        fattureInviate: invoices.length,
        fatture: invoices.map((i) => `${i.n_fattura}/${i.anno}`),
      },
    });

    revalidatePath("/sistema-ts");
    revalidatePath("/invoices");
    return {
      success: true,
      protocollo,
      message: `Trasmissione inviata con successo! Assegnato protocollo n. ${protocollo}`,
    };
  } catch (error) {
    if (!transmissionSuccess) {
      await prisma.pagamento.updateMany({
        where: {
          id: { in: candidateIds },
          id_Utente: userId,
          stato_ts: "IN_TRASMISSIONE",
        },
        data: {
          stato_ts: "DA_INVIARE",
          data_invio_ts: null,
        },
      });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("inviaLottoFatture error", error);
    return { error: `Errore durante la preparazione o trasmissione del lotto: ${msg}` };
  }
}

/**
 * Interroga lo stato di elaborazione del protocollo e scarica ricevuta PDF ed eventuali errori.
 */
export async function sincronizzaEsitoTrasmissione(
  trasmissioneId: number
): Promise<SistemaTsActionState> {
  const userId = await requireUserId();

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
    return { error: "Trasmissione non trovata." };
  }

  const rateLimit = sistemaTsSyncLimiter.consume(String(userId));
  if (!rateLimit.allowed) {
    const retryAfter = rateLimit.retryAfterSeconds ?? 1;
    return {
      error: `Troppe richieste di verifica esito ravvicinate. Attendi ${retryAfter} secondi prima di interrogare nuovamente il Sistema TS.`,
    };
  }

  let clientInfo;
  try {
    clientInfo = await getClientForUser(userId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  const { client } = clientInfo;

  try {
    const esitoRes = await client.interrogaEsito(trasmissione.protocollo);

    if (!esitoRes.success) {
      return { error: esitoRes.errorMessage || "Interrogazione esito non riuscita." };
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

    await logAudit({
      azione: AUDIT_ACTIONS.SISTEMA_TS_SYNC,
      userId,
      entita: "TrasmissioneTs",
      entitaId: trasmissioneId,
      ip: await getClientIp(),
      meta: {
        protocollo: trasmissione.protocollo,
        statoElaborazione: esitoRes.statoElaborazione,
      },
    });

    revalidatePath("/sistema-ts");
    revalidatePath("/invoices");
    return {
      success: true,
      message: `Esito aggiornato: ${esitoRes.descrizioneEsito || "Lavorazione completata"}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("sincronizzaEsitoTrasmissione error", error);
    return { error: `Errore durante la sincronizzazione dell'esito: ${msg}` };
  }
}

/**
 * Annulla una fattura già trasmessa al Sistema TS (invio sincrono con flagOperazione = 'C').
 */
export async function annullaFatturaTs(invoiceId: number): Promise<SistemaTsActionState> {
  const userId = await requireUserId();

  // Recupero automatico self-healing per lock orfani di cancellazione rimasti in IN_TRASMISSIONE
  // oltre il timeout massimo di chiamata a Sogei (120s). Finestra di sicurezza: 5 minuti.
  const STALE_LOCK_MINUTES = 5;
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
    return { error: "Fattura non trovata." };
  }

  if (invoice.stato_ts === "IN_TRASMISSIONE") {
    return {
      error: "La fattura è attualmente in fase di trasmissione. Attendi il completamento prima di annullarla.",
    };
  }

  if (invoice.stato_ts === "DA_INVIARE") {
    return {
      error: "Non è possibile annullare sul Sistema TS una fattura che non è mai stata trasmessa (stato 'Da Inviare').",
    };
  }

  if (invoice.stato_ts === "ANNULLATA_TS") {
    return {
      error: "La fattura risulta già annullata sul Sistema TS.",
    };
  }

  if (invoice.stato_ts !== "INVIATA" && invoice.stato_ts !== "DA_CANCELLARE_SU_TS") {
    return {
      error: "Solo le fatture inviate o in attesa di cancellazione possono essere annullate sul Sistema TS.",
    };
  }

  const rateLimit = sistemaTsTransmissionLimiter.consume(String(userId));
  if (!rateLimit.allowed) {
    const retryAfter = rateLimit.retryAfterSeconds ?? 1;
    return {
      error: `Troppe richieste di trasmissione inviate. Per proteggere la connessione con il Sistema TS, attendi ${retryAfter} secondi prima di riprovare.`,
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
    return { error: err instanceof Error ? err.message : String(err) };
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

      await logAudit({
        azione: AUDIT_ACTIONS.SISTEMA_TS_CANCEL,
        userId,
        entita: "Pagamento",
        entitaId: invoiceId,
        ip: await getClientIp(),
        meta: {
          n_fattura: invoice.n_fattura,
          anno: invoice.anno,
          protocolloCancellazione: protocollo,
        },
      });

      revalidatePath("/invoices");
      revalidatePath("/sistema-ts");
      return {
        success: true,
        protocollo,
        message: `Richiesta di annullamento per la fattura n. ${invoice.n_fattura}/${invoice.anno} presa in carico dal Sistema TS (Prot. ${protocollo}). Lo stato finale sarà verificabile nello Storico Trasmissioni.`,
      };
    } else {
      // Errore di connessione o scarto MEF: contrassegna come DA_CANCELLARE_SU_TS
      await prisma.pagamento.update({
        where: { id: invoiceId },
        data: {
          stato_ts: "DA_CANCELLARE_SU_TS",
        },
      });

      revalidatePath("/invoices");
      revalidatePath("/sistema-ts");

      return {
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

    revalidatePath("/invoices");
    revalidatePath("/sistema-ts");

    return {
      error:
        `Errore di connessione (${msg}). La fattura è stata contrassegnata come 'DA CANCELLARE SU TS'.`,
      fallback: true,
    };
  }
}

/**
 * Ripristina una fattura scartata da Sogei o precedentemente annullata allo stato 'DA_INVIARE'.
 * Consente all'utente di correggere eventuali dati errati e ritrasmetterla a Sistema TS.
 */
export async function ripristinaFatturaPerReinvio(
  invoiceId: number
): Promise<SistemaTsActionState> {
  const userId = await requireUserId();

  const invoice = await prisma.pagamento.findFirst({
    where: { id: invoiceId, id_Utente: userId },
  });

  if (!invoice) {
    return { error: "Fattura non trovata." };
  }

  // Non è consentito riportare la fattura in DA_INVIARE se non è stata prima annullata con successo su Sistema TS
  // o se non è rimasta bloccata in trasmissione
  if (invoice.stato_ts !== "ANNULLATA_TS" && invoice.stato_ts !== "IN_TRASMISSIONE") {
    return {
      error:
        "Non è possibile cambiare lo stato della fattura in 'Da Inviare' se non è stata prima annullata sul Sistema TS o bloccata in trasmissione.",
    };
  }

  await prisma.pagamento.update({
    where: { id: invoiceId },
    data: {
      stato_ts: "DA_INVIARE",
      protocollo_ts: null,
      data_invio_ts: null,
    },
  });

  await logAudit({
    azione: AUDIT_ACTIONS.SISTEMA_TS_RESET,
    userId,
    entita: "Pagamento",
    entitaId: invoiceId,
    ip: await getClientIp(),
    meta: {
      n_fattura: invoice.n_fattura,
      anno: invoice.anno,
      statoPrecedente: invoice.stato_ts,
    },
  });

  revalidatePath("/invoices");
  revalidatePath("/sistema-ts");

  return {
    success: true,
    message: `Fattura n. ${invoice.n_fattura}/${invoice.anno} ripristinata su "Da Inviare".`,
  };
}

export type RicevutaPdfActionResult =
  | { success: true; base64: string; fileName: string }
  | { error: string };

/**
 * Restituisce i byte Base64 del file PDF ricevuta memorizzato per una trasmissione.
 */
export async function getRicevutaPdfBase64(
  trasmissioneId: number
): Promise<RicevutaPdfActionResult> {
  const userId = await requireUserId();

  const trasmissione = await prisma.trasmissioneTs.findFirst({
    where: { id: trasmissioneId, id_Utente: userId },
    select: { pdfRicevuta: true, protocollo: true },
  });

  if (!trasmissione || !trasmissione.pdfRicevuta) {
    return { error: "Ricevuta PDF non trovata per questa trasmissione." };
  }

  return {
    success: true,
    base64: Buffer.from(trasmissione.pdfRicevuta).toString("base64"),
    fileName: `ricevuta_${trasmissione.protocollo}.pdf`,
  };
}

/**
 * Corregge in-place i dati di spesa e/o fiscali di una fattura DA_INVIARE per Sistema TS.
 * Può aggiornare l'anagrafica Pagante e facoltativamente propagare il CF alle altre bozze dello stesso cliente.
 */
export async function correggiFatturaTs(
  input: CorreggiFatturaTsInput
): Promise<SistemaTsActionState> {
  const userId = await requireUserId();

  const parsed = correggiFatturaTsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Dati forniti non validi.",
    };
  }

  const {
    invoiceId,
    paganteCf,
    aggiornaAnagrafica,
    propagaFattureInAttesa,
    flagOpposizione,
    dataPagamento,
    pagamentoTracciato,
    bolloCodice,
  } = parsed.data;

  const invoice = await prisma.pagamento.findFirst({
    where: { id: invoiceId, id_Utente: userId },
    include: { pagante: true, paziente: true },
  });

  if (!invoice) {
    return { error: "Fattura non trovata." };
  }

  if (
    invoice.stato_ts === "INVIATA" ||
    invoice.stato_ts === "IN_TRASMISSIONE" ||
    invoice.stato_ts === "DA_CANCELLARE_SU_TS"
  ) {
    return {
      error:
        "Non è possibile modificare i dati di una fattura già trasmessa o in fase di trasmissione.",
    };
  }

  // Validazione Codice Fiscale se non c'è opposizione del paziente
  const targetCf = paganteCf ? paganteCf.trim().toUpperCase() : null;
  if (!flagOpposizione) {
    if (!targetCf) {
      return {
        error:
          "È necessario inserire un Codice Fiscale valido oppure selezionare l'opposizione alla trasmissione.",
      };
    }
    const cfCheck = validateCodiceFiscale(targetCf);
    if (!cfCheck.valid) {
      return {
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

        for (const draft of otherDrafts) {
          const draftSnap = resolveAnagrafica(draft);
          const newDraftSnap = {
            ...draftSnap,
            pagante: {
              ...draftSnap.pagante,
              cf: targetCf,
            },
          };
          await tx.pagamento.update({
            where: { id: draft.id },
            data: {
              snapshotAnagrafica: newDraftSnap as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }
    });
  } catch (error) {
    if (isUniqueViolationOnField(error, "bolloCodice")) {
      return { error: "Codice marca da bollo già utilizzato." };
    }
    if (isUniqueViolationOnField(error, "cf")) {
      return { error: "Codice Fiscale già presente per un altro cliente." };
    }
    console.error("correggiFatturaTs error", error);
    return { error: "Errore durante il salvataggio delle modifiche." };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.SISTEMA_TS_CORRECTION,
    userId,
    entita: "Pagamento",
    entitaId: invoice.id,
    ip: await getClientIp(),
    meta: {
      n_fattura: invoice.n_fattura,
      anno: invoice.anno,
      cfModificato: targetCf !== invoice.pagante.cf,
      propagaFattureInAttesa,
      flagOpposizione,
    },
  });

  revalidatePath("/sistema-ts");
  revalidatePath("/invoices");
  if (aggiornaAnagrafica) {
    revalidatePath("/payers");
  }

  return {
    success: true,
    message: `Fattura n. ${invoice.n_fattura}/${invoice.anno} corretta con successo.`,
  };
}
