"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { getClientIp } from "@/lib/auth/client-ip";
import {
  sistemaTsTransmissionLimiter,
  sistemaTsSyncLimiter,
} from "@/lib/sistemats/rate-limiters";
import {
  sistemaTsSettingsSchema,
  invioLottoSchema,
  type SistemaTsSettingsInput,
} from "@/lib/validations/sistema-ts";
import {
  correggiFatturaTsSchema,
  type CorreggiFatturaTsInput,
} from "@/lib/validations/sistema-ts-correction";
import { saveSistemaTsSettingsService } from "@/lib/sistemats/services/settings.service";
import { inviaLottoFattureService } from "@/lib/sistemats/services/transmission.service";
import { sincronizzaEsitoTrasmissioneService } from "@/lib/sistemats/services/reconciliation.service";
import {
  annullaFatturaTsService,
  ripristinaFatturaPerReinvioService,
} from "@/lib/sistemats/services/cancellation.service";
import { correggiFatturaTsService } from "@/lib/sistemats/services/correction.service";
import { isValidId } from "@/lib/validations/id";

export type SistemaTsActionState =
  | { success: true; protocollo?: string; message?: string }
  | { success: false; error: string; fallback?: boolean };

/**
 * Salva o aggiorna le credenziali e impostazioni del Sistema TS per l'utente corrente.
 */
export async function saveSistemaTsSettings(
  input: SistemaTsSettingsInput
): Promise<SistemaTsActionState> {
  const userId = await requireUserId();

  const parsed = sistemaTsSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Dati non validi" };
  }

  const res = await saveSistemaTsSettingsService(userId, parsed.data);
  if (!res.success) {
    return res;
  }

  await logAudit({
    azione: AUDIT_ACTIONS.SISTEMA_TS_SETTINGS_UPDATE,
    userId,
    entita: "ImpostazioniSistemaTs",
    ip: await getClientIp(),
  });

  revalidatePath("/settings/sistema-ts");
  revalidatePath("/sistema-ts");
  return { success: true, message: "Impostazioni Sistema TS salvate con successo." };
}

/**
 * Trasmette un lotto di fatture selezionate al Sistema TS in formato SOAP MTOM.
 */
export async function inviaLottoFatture(invoiceIds: number[]): Promise<SistemaTsActionState> {
  const userId = await requireUserId();

  const rateLimit = sistemaTsTransmissionLimiter.consume(String(userId));
  if (!rateLimit.allowed) {
    const retryAfter = rateLimit.retryAfterSeconds ?? 1;
    return {
      success: false,
      error: `Troppe richieste di trasmissione inviate. Per proteggere la connessione con il Sistema TS, attendi ${retryAfter} secondi prima di riprovare.`,
    };
  }

  const parsed = invioLottoSchema.safeParse({ invoiceIds });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Selezione non valida." };
  }

  const res = await inviaLottoFattureService({ userId, invoiceIds: parsed.data.invoiceIds });
  if (!res.success) {
    return res;
  }

  await logAudit({
    azione: AUDIT_ACTIONS.SISTEMA_TS_SEND,
    userId,
    entita: "TrasmissioneTs",
    ip: await getClientIp(),
    meta: {
      protocollo: res.protocollo,
      fattureInviate: res.invoicesCount,
      fatture: res.invoicesLabels,
    },
  });

  revalidatePath("/sistema-ts");
  revalidatePath("/invoices");
  return {
    success: true,
    protocollo: res.protocollo,
    message: `Trasmissione inviata con successo! Assegnato protocollo n. ${res.protocollo}`,
  };
}

/**
 * Interroga lo stato di elaborazione del protocollo e scarica ricevuta PDF ed eventuali errori.
 */
export async function sincronizzaEsitoTrasmissione(
  trasmissioneId: number
): Promise<SistemaTsActionState> {
  const userId = await requireUserId();

  if (!isValidId(trasmissioneId)) {
    return { success: false, error: "Richiesta non valida" };
  }

  const rateLimit = sistemaTsSyncLimiter.consume(String(userId));
  if (!rateLimit.allowed) {
    const retryAfter = rateLimit.retryAfterSeconds ?? 1;
    return {
      success: false,
      error: `Troppe richieste di verifica esito ravvicinate. Attendi ${retryAfter} secondi prima di interrogare nuovamente il Sistema TS.`,
    };
  }

  const res = await sincronizzaEsitoTrasmissioneService({ userId, trasmissioneId });
  if (!res.success) {
    return res;
  }

  await logAudit({
    azione: AUDIT_ACTIONS.SISTEMA_TS_SYNC,
    userId,
    entita: "TrasmissioneTs",
    entitaId: trasmissioneId,
    ip: await getClientIp(),
    meta: {
      protocollo: res.protocollo,
      statoElaborazione: res.statoElaborazione,
    },
  });

  revalidatePath("/sistema-ts");
  revalidatePath("/invoices");
  return {
    success: true,
    message: `Esito aggiornato: ${res.descrizioneEsito || "Lavorazione completata"}`,
  };
}

// Tipo con nome, non inline: i test di invarianti (verify-actions-auth,
// verify-audit-log-coverage) leggono il corpo dalla prima "{" dopo la firma.
type ConfermaEsitoOpzioni = { confermaEsitoVerificato?: boolean };

/**
 * Annulla una fattura già trasmessa al Sistema TS (invio sincrono con flagOperazione = 'C').
 */
export async function annullaFatturaTs(
  invoiceId: number,
  opzioni?: ConfermaEsitoOpzioni
): Promise<SistemaTsActionState> {
  const userId = await requireUserId();

  if (!isValidId(invoiceId)) {
    return { success: false, error: "Richiesta non valida" };
  }

  const rateLimit = sistemaTsTransmissionLimiter.consume(String(userId));
  if (!rateLimit.allowed) {
    const retryAfter = rateLimit.retryAfterSeconds ?? 1;
    return {
      success: false,
      error: `Troppe richieste di trasmissione inviate. Per proteggere la connessione con il Sistema TS, attendi ${retryAfter} secondi prima di riprovare.`,
    };
  }

  // Endpoint RPC pubblico: vale solo un `true` esplicito (P005).
  const confermaEsitoVerificato = opzioni?.confermaEsitoVerificato === true;
  const res = await annullaFatturaTsService({ userId, invoiceId, confermaEsitoVerificato });
  if (!res.success) {
    revalidatePath("/invoices");
    revalidatePath("/sistema-ts");
    return res;
  }

  await logAudit({
    azione: AUDIT_ACTIONS.SISTEMA_TS_CANCEL,
    userId,
    entita: "Pagamento",
    entitaId: invoiceId,
    ip: await getClientIp(),
    meta: {
      n_fattura: res.invoice.n_fattura,
      anno: res.invoice.anno,
      protocolloCancellazione: res.protocollo,
      ...(confermaEsitoVerificato ? { esitoIncertoConfermato: true } : {}),
    },
  });

  revalidatePath("/invoices");
  revalidatePath("/sistema-ts");
  return {
    success: true,
    protocollo: res.protocollo,
    message: `Richiesta di annullamento per la fattura n. ${res.invoice.n_fattura}/${res.invoice.anno} presa in carico dal Sistema TS (Prot. ${res.protocollo}). Lo stato finale sarà verificabile nello Storico Trasmissioni.`,
  };
}

/**
 * Riporta allo stato 'DA_INVIARE' una fattura annullata sul Sistema TS (ANNULLATA_TS) o
 * rimasta bloccata in un invio iniziale (IN_TRASMISSIONE senza protocollo, lock scaduto).
 * Consente all'utente di correggere eventuali dati errati e ritrasmetterla a Sistema TS.
 * Le regole sono in ripristinaFatturaPerReinvioService (CR-03). Un invio con
 * esito incerto si sblocca solo con `confermaEsitoVerificato` (CR-10).
 */
export async function ripristinaFatturaPerReinvio(
  invoiceId: number,
  opzioni?: ConfermaEsitoOpzioni
): Promise<SistemaTsActionState> {
  const userId = await requireUserId();

  if (!isValidId(invoiceId)) {
    return { success: false, error: "Richiesta non valida" };
  }

  const res = await ripristinaFatturaPerReinvioService({
    userId,
    invoiceId,
    // Endpoint RPC pubblico: vale solo un `true` esplicito.
    confermaEsitoVerificato: opzioni?.confermaEsitoVerificato === true,
  });
  if (!res.success) {
    return res;
  }

  await logAudit({
    azione: AUDIT_ACTIONS.SISTEMA_TS_RESET,
    userId,
    entita: "Pagamento",
    entitaId: invoiceId,
    ip: await getClientIp(),
    meta: {
      n_fattura: res.invoice.n_fattura,
      anno: res.invoice.anno,
      statoPrecedente: res.invoice.statoPrecedente,
      ...(res.esitoIncertoConfermato
        ? { esitoIncertoConfermato: true, numFatture: res.numFatture }
        : {}),
    },
  });

  revalidatePath("/invoices");
  revalidatePath("/sistema-ts");

  if (res.esitoIncertoConfermato) {
    return {
      success: true,
      message: `Lotto sbloccato: ${res.numFatture} ${res.numFatture === 1 ? "fattura riportata" : "fatture riportate"} su "Da Inviare".`,
    };
  }

  return {
    success: true,
    message: `Fattura n. ${res.invoice.n_fattura}/${res.invoice.anno} ripristinata su "Da Inviare".`,
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
      success: false,
      error: parsed.error.issues[0]?.message ?? "Dati forniti non validi.",
    };
  }

  const res = await correggiFatturaTsService({ userId, data: parsed.data });
  if (!res.success) {
    return res;
  }

  await logAudit({
    azione: AUDIT_ACTIONS.SISTEMA_TS_CORRECTION,
    userId,
    entita: "Pagamento",
    entitaId: res.invoice.id,
    ip: await getClientIp(),
    meta: {
      n_fattura: res.invoice.n_fattura,
      anno: res.invoice.anno,
      cfModificato: res.cfModificato,
      propagaFattureInAttesa: res.propagaFattureInAttesa,
      flagOpposizione: res.flagOpposizione,
    },
  });

  revalidatePath("/sistema-ts");
  revalidatePath("/invoices");
  if (res.aggiornaAnagrafica) {
    revalidatePath("/payers");
  }

  return {
    success: true,
    message: `Fattura n. ${res.invoice.n_fattura}/${res.invoice.anno} corretta con successo.`,
  };
}
