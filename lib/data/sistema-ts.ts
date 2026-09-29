import "server-only";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { validateCodiceFiscale } from "@/lib/sistemats/cf-validator";
import { validateImportoSpesa } from "@/lib/sistemats/payload-builder";
import { calcolaTotaliFattura } from "@/lib/fiscal/bollo";
import { resolveAnagrafica, isSnapshotAnagrafica } from "@/lib/invoices/anagrafica-snapshot";
import { parseDateInput, isDataPagamentoFutura } from "@/lib/utils/date";
import { Prisma, type $Enums } from "@prisma/client";

export interface FatturaTsListItem {
  id: number;
  n_fattura: number;
  anno: number;
  data: Date;
  data_pagamento?: Date | null;
  dataEffettiva: Date;
  isDataFutura: boolean;
  haAnomalie: boolean;
  isProntaPerInvio: boolean;
  prezzo_totale: number;
  mod_pag: $Enums.ModalitaPagamento;
  pagamento_tracciato: boolean;
  natura_iva: string;
  flag_opposizione: boolean;
  bollo: number;
  bolloCodice: string | null;
  stato_ts: $Enums.StatoTs;
  protocollo_ts: string | null;
  protocollo_cancellazione_ts: string | null;
  data_invio_ts: Date | null;
  // CR-10: invio iniziale partito verso Sogei senza esito certo. Va verificato
  // sul portale prima di sbloccarlo.
  esitoDaVerificare: boolean;
  // CR-07: annullamento verso Sogei in corso (lock recente).
  annullamentoInCorso: boolean;
  // P005: ultimo annullamento partito senza esito certo, da verificare sul
  // portale prima di riprovare.
  annullamentoDaVerificare: boolean;
  paganteNomeCompleto: string;
  paganteCf: string | null;
  pazienteNomeCompleto: string;
  cfValido: boolean;
  cfErrore?: string;
  importoValido: boolean;
  importoErrore?: string;
  richiedeBollo: boolean;
  bolloMancante: boolean;
  id_Pagante?: number;
}

export async function getSistemaTsSettings() {
  const userId = await requireUserId();
  const settings = await prisma.impostazioniSistemaTs.findUnique({
    where: { id_Utente: userId },
  });

  if (!settings) return null;

  return {
    id: settings.id,
    username: settings.username,
    hasPassword: !!settings.passwordEncrypted,
    hasPincode: !!settings.pincodeEncrypted,
    codiceRegione: settings.codiceRegione ?? "000",
    codiceAsl: settings.codiceAsl ?? "000",
    codiceStruttura: settings.codiceStruttura ?? "",
    naturaIvaDefault: settings.naturaIvaDefault,
  };
}

export async function getFatturePerInvioTs(
  params?: {
    dateFrom?: string;
    dateTo?: string;
    stato?: string;
  }
): Promise<FatturaTsListItem[]> {
  const userId = await requireUserId();
  const where: Prisma.PagamentoWhereInput = {
    id_Utente: userId,
  };

  if (params?.stato && params.stato !== "ALL") {
    where.stato_ts = params.stato as $Enums.StatoTs;
  }

  if (params?.dateFrom || params?.dateTo) {
    const dataFilter: Prisma.DateTimeFilter = {};
    if (params.dateFrom) {
      const from = parseDateInput(params.dateFrom);
      from.setHours(0, 0, 0, 0);
      dataFilter.gte = from;
    }
    if (params.dateTo) {
      const to = parseDateInput(params.dateTo);
      to.setHours(23, 59, 59, 999);
      dataFilter.lte = to;
    }
    where.OR = [
      { data_pagamento: dataFilter },
      { data_pagamento: null, data: dataFilter },
    ];
  }

  const invoices = await prisma.pagamento.findMany({
    where,
    include: {
      pagante: true,
      paziente: true,
    },
    orderBy: [{ anno: "desc" }, { n_fattura: "desc" }],
  });

  const staleThresholdMs = Date.now() - STALE_LOCK_MINUTES * 60 * 1000;

  return invoices.map((inv) => {
    const anagrafica = resolveAnagrafica(inv);
    const cf = anagrafica.pagante.cf?.trim() ?? null;
    const cfCheck = cf ? validateCodiceFiscale(cf) : { valid: false, error: "Codice Fiscale mancante" };
    const prezzoTotale = inv.prezzo_totale.toNumber();
    const importoCheck = validateImportoSpesa(prezzoTotale);
    const { bolloDovuto: richiedeBollo, bolloMancante } = calcolaTotaliFattura(
      prezzoTotale,
      inv.bolloCodice
    );

    const cfValido = inv.flag_opposizione ? true : cfCheck.valid;
    const cfErrore = inv.flag_opposizione ? undefined : cfCheck.error;
    const importoValido = importoCheck.valid;
    const importoErrore = importoCheck.error;
    // ARCH-06 / SMELL-10: una fattura con bollo mancante ha anomalie e non è pronta per l'invio
    const haAnomalie = !cfValido || !importoValido || bolloMancante;

    const dataEffettiva = inv.data_pagamento ?? inv.data;
    const isDataFutura = isDataPagamentoFutura(inv.data_pagamento, inv.data);
    const isProntaPerInvio = inv.stato_ts === "DA_INVIARE" && !isDataFutura && !haAnomalie;

    return {
      id: inv.id,
      n_fattura: inv.n_fattura,
      anno: inv.anno,
      data: inv.data,
      data_pagamento: inv.data_pagamento,
      dataEffettiva,
      isDataFutura,
      haAnomalie,
      isProntaPerInvio,
      prezzo_totale: prezzoTotale,
      mod_pag: inv.mod_pag,
      pagamento_tracciato: inv.pagamento_tracciato,
      natura_iva: inv.natura_iva,
      flag_opposizione: inv.flag_opposizione,
      bollo: inv.bollo.toNumber(),
      bolloCodice: inv.bolloCodice,
      stato_ts: inv.stato_ts,
      protocollo_ts: inv.protocollo_ts,
      protocollo_cancellazione_ts: inv.protocollo_cancellazione_ts,
      data_invio_ts: inv.data_invio_ts,
      esitoDaVerificare:
        inv.stato_ts === "IN_TRASMISSIONE" &&
        inv.protocollo_ts === null &&
        inv.invio_avviato_ts !== null,
      annullamentoInCorso:
        inv.annullamento_avviato_ts !== null &&
        inv.annullamento_avviato_ts.getTime() >= staleThresholdMs,
      annullamentoDaVerificare: inv.annullamento_incerto_ts !== null,
      paganteNomeCompleto: `${anagrafica.pagante.cognome} ${anagrafica.pagante.nome}`,
      paganteCf: cf,
      pazienteNomeCompleto: `${anagrafica.paziente.cognome} ${anagrafica.paziente.nome}`,
      cfValido,
      cfErrore,
      importoValido,
      importoErrore,
      richiedeBollo,
      bolloMancante,
      id_Pagante: inv.id_Pagante,
    };
  });
}

import {
  parseCsvErroriTs,
  getErrorsForInvoice,
  type ErroreDocumentoTs,
} from "@/lib/sistemats/csv-parser";
import { STALE_LOCK_MINUTES } from "@/lib/sistemats/lock-timing";

export { parseCsvErroriTs, getErrorsForInvoice, type ErroreDocumentoTs };

export interface FatturaInTrasmissioneItem {
  id: number;
  n_fattura: number;
  anno: number;
  data: Date;
  prezzo_totale: number;
  paganteNome: string;
  paganteCf: string | null;
  esitoFattura:
    | "ACCOLTA"
    | "ACCOLTA_CON_WARNING"
    | "SCARTATA"
    | "GIA_PRESENTE_TS"
    | "IN_ELABORAZIONE";
  stato_ts: $Enums.StatoTs;
  errori: ErroreDocumentoTs[];
}

export async function getStoricoTrasmissioniTs() {
  const userId = await requireUserId();
  const trasmissioni = await prisma.trasmissioneTs.findMany({
    where: { id_Utente: userId },
    include: {
      fatture: {
        select: {
          id: true,
          n_fattura: true,
          anno: true,
          data: true,
          prezzo_totale: true,
          stato_ts: true,
          snapshotAnagrafica: true,
          pagante: {
            select: {
              nome: true,
              cognome: true,
              cf: true,
            },
          },
        },
        orderBy: [{ anno: "asc" }, { n_fattura: "asc" }],
      },
    },
    orderBy: { dataInvio: "desc" },
  });

  const cancellationProtocols = trasmissioni
    .filter((t) => t.nomeFile.startsWith("annulla_"))
    .map((t) => t.protocollo);

  const cancelledInvoices =
    cancellationProtocols.length > 0
      ? await prisma.pagamento.findMany({
          where: {
            id_Utente: userId,
            protocollo_cancellazione_ts: { in: cancellationProtocols },
          },
          select: {
            id: true,
            n_fattura: true,
            anno: true,
            data: true,
            prezzo_totale: true,
            stato_ts: true,
            protocollo_cancellazione_ts: true,
            snapshotAnagrafica: true,
            pagante: {
              select: {
                nome: true,
                cognome: true,
                cf: true,
              },
            },
          },
          orderBy: [{ anno: "asc" }, { n_fattura: "asc" }],
        })
      : [];

  const cancelledInvoicesByProtocol = new Map<string, typeof cancelledInvoices>();
  for (const inv of cancelledInvoices) {
    if (inv.protocollo_cancellazione_ts) {
      const list = cancelledInvoicesByProtocol.get(inv.protocollo_cancellazione_ts) || [];
      list.push(inv);
      cancelledInvoicesByProtocol.set(inv.protocollo_cancellazione_ts, list);
    }
  }

  return trasmissioni.map((t) => {
    const isCancellazione = t.nomeFile.startsWith("annulla_");
    const rawFatture = isCancellazione
      ? (t.fatture && t.fatture.length > 0 ? t.fatture : (cancelledInvoicesByProtocol.get(t.protocollo) || []))
      : t.fatture;

    const errorsMap = parseCsvErroriTs(t.csvErrori);

    const fatture: FatturaInTrasmissioneItem[] = rawFatture.map((f) => {
      const docErrors = getErrorsForInvoice(errorsMap, f);
      // P009: il pagante con cui la fattura è stata trasmessa, non quello live.
      const pagante = isSnapshotAnagrafica(f.snapshotAnagrafica)
        ? f.snapshotAnagrafica.pagante
        : f.pagante;
      const hasDuplicateS017 = docErrors.some((e) => e.codiceErrore === "S017");
      const hasScarto = docErrors.some((e) => e.tipo === "ERRORE" && e.codiceErrore !== "S017");
      const hasWarning = docErrors.some((e) => e.tipo === "WARNING");

      let esitoFattura:
        | "ACCOLTA"
        | "ACCOLTA_CON_WARNING"
        | "SCARTATA"
        | "GIA_PRESENTE_TS"
        | "IN_ELABORAZIONE";
      if (t.statoElaborazione === "0" || !t.statoElaborazione) {
        esitoFattura = "IN_ELABORAZIONE";
      } else if (hasDuplicateS017) {
        esitoFattura = "GIA_PRESENTE_TS";
      } else if (t.statoElaborazione === "2") {
        esitoFattura = "ACCOLTA";
      } else if (hasScarto || t.statoElaborazione === "4" || t.statoElaborazione === "5") {
        esitoFattura = "SCARTATA";
      } else if (hasWarning) {
        esitoFattura = "ACCOLTA_CON_WARNING";
      } else {
        esitoFattura = "ACCOLTA";
      }

      return {
        id: f.id,
        n_fattura: f.n_fattura,
        anno: f.anno,
        data: f.data,
        prezzo_totale: f.prezzo_totale.toNumber(),
        paganteNome: pagante ? `${pagante.cognome} ${pagante.nome}` : "-",
        paganteCf: pagante?.cf ?? null,
        esitoFattura,
        stato_ts: f.stato_ts,
        errori: docErrors,
      };
    });

    return {
      id: t.id,
      tipo: isCancellazione ? "CANCELLAZIONE" : "INVIO",
      protocollo: t.protocollo,
      nomeFile: t.nomeFile,
      dataInvio: t.dataInvio,
      statoElaborazione: t.statoElaborazione,
      codiceEsito: t.codiceEsito,
      descrizioneEsito: t.descrizioneEsito,
      numRicevuti: t.numRicevuti,
      numAccolti: t.numAccolti,
      numScartati: t.numScartati,
      hasPdfRicevuta: !!t.pdfRicevuta,
      hasCsvErrori: !!t.csvErrori,
      csvErrori: t.csvErrori,
      totaleFatture: rawFatture.length,
      fatture,
    };
  });
}
