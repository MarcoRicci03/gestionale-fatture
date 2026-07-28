import { MESI } from "@/lib/constants/mesi";
import { roundCurrency } from "@/lib/utils/currency";

export type InvoiceMutableSnapshot = {
  id_Pagante: number;
  id_Paziente: number;
  data: Date;
  mod_pag: string;
  sedute: number | null;
  commento: string | null;
  citta: string;
  cap: string;
  bolloCodice: string | null;
  mesi: { mese: string; prezzo: number }[];
};

export type InvoiceFieldChange = { da: unknown; a: unknown };

// Ordina secondo l'ordine canonico dei mesi (non l'ordine di inserimento in
// DB, non garantito) e arrotonda, così due array con contenuto equivalente
// ma ordine diverso o rumore di floating point non generano un diff fittizio.
function normalizeMesi(
  mesi: InvoiceMutableSnapshot["mesi"]
): Record<string, number> {
  const perMese = new Map(mesi.map((m) => [m.mese, roundCurrency(m.prezzo)]));
  const normalizzati: Record<string, number> = {};
  for (const mese of MESI) {
    const prezzo = perMese.get(mese);
    if (prezzo !== undefined) normalizzati[mese] = prezzo;
  }
  return normalizzati;
}

export function buildInvoiceChangeDiff(
  before: InvoiceMutableSnapshot,
  after: InvoiceMutableSnapshot
): Record<string, InvoiceFieldChange> {
  const modifiche: Record<string, InvoiceFieldChange> = {};

  const registra = (campo: string, da: unknown, a: unknown) => {
    if (da !== a) modifiche[campo] = { da, a };
  };

  registra("id_Pagante", before.id_Pagante, after.id_Pagante);
  registra("id_Paziente", before.id_Paziente, after.id_Paziente);
  registra("data", before.data.toISOString(), after.data.toISOString());
  registra("mod_pag", before.mod_pag, after.mod_pag);
  registra("sedute", before.sedute, after.sedute);
  registra("commento", before.commento, after.commento);
  registra("citta", before.citta, after.citta);
  registra("cap", before.cap, after.cap);
  registra("bolloCodice", before.bolloCodice, after.bolloCodice);

  const mesiPrima = normalizeMesi(before.mesi);
  const mesiDopo = normalizeMesi(after.mesi);
  if (JSON.stringify(mesiPrima) !== JSON.stringify(mesiDopo)) {
    modifiche.mesi = { da: mesiPrima, a: mesiDopo };
  }

  return modifiche;
}
