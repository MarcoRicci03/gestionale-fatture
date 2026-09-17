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
import { parseCsvErroriTs } from "@/lib/sistemats/csv-parser";
import { resolveAnagrafica } from "@/lib/invoices/anagrafica-snapshot";
import { SOGLIA_BOLLO, IMPORTO_BOLLO } from "@/lib/constants/bollo";
import {
  sistemaTsSettingsSchema,
  type SistemaTsSettingsInput,
} from "@/lib/validations/sistema-ts";
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

/**
 * Trasmette un lotto di fatture selezionate al Sistema TS in formato SOAP MTOM.
 */
export async function inviaLottoFatture(invoiceIds: number[]): Promise<SistemaTsActionState> {
  const userId = await requireUserId();

  if (!invoiceIds || invoiceIds.length === 0) {
    return { error: "Nessuna fattura selezionata per l'invio." };
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
  const STALE_LOCK_MINUTES = 5;
  const staleThreshold = new Date(Date.now() - STALE_LOCK_MINUTES * 60 * 1000);
  await prisma.pagamento.updateMany({
    where: {
      id_Utente: userId,
      stato_ts: "IN_TRASMISSIONE",
      data_invio_ts: { lt: staleThreshold },
    },
    data: {
      stato_ts: "DA_INVIARE",
      data_invio_ts: null,
    },
  });

  // Recupera le fatture selezionate dell'utente
  const invoices = await prisma.pagamento.findMany({
    where: {
      id: { in: invoiceIds },
      id_Utente: userId,
      stato_ts: "DA_INVIARE",
    },
    include: {
      pagante: true,
      paziente: true,
    },
    orderBy: [{ anno: "asc" }, { n_fattura: "asc" }],
  });

  if (invoices.length === 0) {
    return { error: "Nessuna fattura idonea trovata tra quelle selezionate." };
  }

  // Pre-validazione Codici Fiscali
  const documenti: DocumentoSpesaPayload[] = [];
  for (const inv of invoices) {
    const anagrafica = resolveAnagrafica(inv);
    const cf = anagrafica.pagante.cf?.trim() ?? "";
    // Pre-validazione Codice Fiscale (se non c'è opposizione dell'assistito)
    if (!inv.flag_opposizione) {
      const cfValidation = validateCodiceFiscale(cf);
      if (!cfValidation.valid) {
        return {
          error: `Fattura n. ${inv.n_fattura}/${inv.anno}: Codice Fiscale Pagante ('${cf || "mancante"}') non valido: ${cfValidation.error}`,
        };
      }
    }

    const prezzoTotale = inv.prezzo_totale.toNumber();
    const vociSpesa = [
      {
        tipoSpesa: "SP" as const,
        importo: prezzoTotale,
        naturaIva: inv.natura_iva || "N2.2",
      },
    ];

    // Se > 77.47 o bollo presente, aggiunge riga bollo da 2.00 € con natura N1
    if (prezzoTotale > SOGLIA_BOLLO || inv.bolloCodice) {
      vociSpesa.push({
        tipoSpesa: "SP" as const,
        importo: IMPORTO_BOLLO,
        naturaIva: "N1",
      });
    }

    documenti.push({
      idSpesa: {
        pIva: user.pIva,
        dataEmissione: inv.data,
        numDocumento: String(inv.n_fattura),
        dispositivo: 1,
      },
      dataPagamento: inv.data,
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

  const candidateIds = invoices.map((i) => i.id);
  const lockTimestamp = new Date();

  // Lock atomico: transizione immediata a IN_TRASMISSIONE prima della chiamata di rete per prevenire doppie trasmissioni
  const lockResult = await prisma.pagamento.updateMany({
    where: {
      id: { in: candidateIds },
      id_Utente: userId,
      stato_ts: "DA_INVIARE",
    },
    data: {
      stato_ts: "IN_TRASMISSIONE",
      data_invio_ts: lockTimestamp,
    },
  });

  if (lockResult.count !== candidateIds.length) {
    // Collisione di concorrenza rilevata (es. doppio click o invio parallelo):
    // rollback delle sole fatture marcate da questa esecuzione
    if (lockResult.count > 0) {
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
    }
    return {
      error:
        "Una o più fatture selezionate sono già in fase di trasmissione o non sono più nello stato 'Da Inviare'. Riprova tra poco.",
    };
  }

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
      const trasmissione = await tx.trasmissioneTs.create({
        data: {
          id_Utente: userId,
          protocollo,
          nomeFile: fileName,
          dataInvio: now,
          statoElaborazione: "0", // In elaborazione
          codiceEsito: res.codiceEsito,
          descrizioneEsito: res.descrizioneEsito || "Trasmissione inviata con successo",
          numRicevuti: invoices.length,
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
          id_TrasmissioneTs: trasmissione.id,
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
  });

  if (!trasmissione) {
    return { error: "Trasmissione non trovata." };
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

    await prisma.trasmissioneTs.update({
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

    if (isCancellazione) {
      if (esitoRes.statoElaborazione === "2" || esitoRes.statoElaborazione === "3") {
        // Accolto: la cancellazione è andata a buon fine sul Sistema TS
        await prisma.pagamento.updateMany({
          where: {
            id_Utente: userId,
            protocollo_cancellazione_ts: trasmissione.protocollo,
          },
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
        await prisma.pagamento.updateMany({
          where: {
            id_Utente: userId,
            protocollo_cancellazione_ts: trasmissione.protocollo,
          },
          data: {
            stato_ts: "INVIATA",
          },
        });
      }
    } else if (csvText) {
      const errMap = parseCsvErroriTs(csvText);

      // 1. Fatture con codice S017 (IDENTIFICATIVO DOCUMENTO FISCALE GIA' PRESENTE):
      // Significa che la spesa è già stata acquisita e registrata con successo su Sistema TS.
      // Non va rimessa in DA_INVIARE (verrebbe sempre rifiutata), ma impostata su INVIATA.
      const giaPresentiDocNums = Array.from(errMap.entries())
        .filter(([, errs]) => errs.some((e) => e.codiceErrore === "S017"))
        .map(([numDoc]) => Number(numDoc))
        .filter((n) => !isNaN(n));

      if (giaPresentiDocNums.length > 0) {
        await prisma.pagamento.updateMany({
          where: {
            id_Utente: userId,
            id_TrasmissioneTs: trasmissioneId,
            n_fattura: { in: giaPresentiDocNums },
          },
          data: {
            stato_ts: "INVIATA",
          },
        });
      }

      // 2. Altre fatture scartate per anomalie di compilazione (es. S050, CF non valido, ecc.):
      // Sogei non le ha acquisite; vanno rimesse in DA_INVIARE per consentire la correzione.
      const scartatiDocNums = Array.from(errMap.entries())
        .filter(([, errs]) =>
          errs.some((e) => e.tipo === "ERRORE" && e.codiceErrore !== "S017")
        )
        .map(([numDoc]) => Number(numDoc))
        .filter((n) => !isNaN(n));

      if (scartatiDocNums.length > 0) {
        await prisma.pagamento.updateMany({
          where: {
            id_Utente: userId,
            id_TrasmissioneTs: trasmissioneId,
            n_fattura: { in: scartatiDocNums },
          },
          data: {
            stato_ts: "DA_INVIARE",
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
      await prisma.pagamento.updateMany({
        where: {
          id_Utente: userId,
          id_TrasmissioneTs: trasmissioneId,
        },
        data: {
          stato_ts: "DA_INVIARE",
        },
      });
    }

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

  let clientInfo;
  try {
    clientInfo = await getClientForUser(userId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  const { client, proprietario, user } = clientInfo;
  const anagrafica = resolveAnagrafica(invoice);
  const cf = anagrafica.pagante.cf?.trim() ?? "";

  const cfCittadino = invoice.flag_opposizione ? "" : cf;
  const prezzoTotale = invoice.prezzo_totale.toNumber();
  const vociSpesa = [
    {
      tipoSpesa: "SP" as const,
      importo: prezzoTotale,
      naturaIva: invoice.natura_iva || "N2.2",
    },
  ];

  if (prezzoTotale > SOGLIA_BOLLO || invoice.bolloCodice) {
    vociSpesa.push({
      tipoSpesa: "SP" as const,
      importo: IMPORTO_BOLLO,
      naturaIva: "N1",
    });
  }

  const docCancellazione: DocumentoSpesaPayload = {
    idSpesa: {
      pIva: user.pIva,
      dataEmissione: invoice.data,
      numDocumento: String(invoice.n_fattura),
      dispositivo: 1,
    },
    dataPagamento: invoice.data,
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
