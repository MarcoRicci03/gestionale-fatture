import type { FatturaMese, Pagamento, Pagante, Paziente } from "@prisma/client";
import { formatDateDisplay } from "@/lib/utils/date";
import { SOGLIA_BOLLO } from "@/lib/constants/bollo";
import { resolveAnagrafica } from "@/lib/invoices/anagrafica-snapshot";
import { getBolloImporto, getTotaleConBollo } from "@/lib/invoices/bollo-total";

// Stessa forma prodotta da getInvoices()/getInvoiceById() (lib/data/invoices.ts):
// Decimal già convertiti a number, relazioni incluse. pagante/paziente non
// null: id_Pagante/id_Paziente su Pagamento sono FK obbligatorie (non
// opzionali), quindi con `include` sono sempre risolte — stessa forma di
// InvoiceWithRelations in lib/pdf/types.ts.
export type ExportableInvoice = Omit<Pagamento, "prezzo_totale"> & {
  prezzo_totale: number;
  mesi: (Omit<FatturaMese, "prezzo"> & { prezzo: number })[];
  pagante: Pagante;
  paziente: Paziente;
};

function formatCurrency(amount: number): string {
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export type ExportColumnCategory =
  | "fattura"
  | "pagante"
  | "paziente"
  | "dettaglio";

export type ExportColumn = {
  key: string;
  label: string;
  category: ExportColumnCategory;
  getValue: (invoice: ExportableInvoice) => string | number;
};

export const EXPORT_COLUMN_CATEGORY_LABELS: Record<ExportColumnCategory, string> = {
  fattura: "Dati fattura base",
  pagante: "Dati pagante",
  paziente: "Dati paziente",
  dettaglio: "Mesi/sedute/bollo",
};

export const EXPORT_COLUMNS: ExportColumn[] = [
  {
    key: "n_fattura",
    label: "N. Fattura",
    category: "fattura",
    getValue: (i) => i.n_fattura,
  },
  { key: "anno", label: "Anno", category: "fattura", getValue: (i) => i.anno },
  {
    key: "data",
    label: "Data",
    category: "fattura",
    getValue: (i) => formatDateDisplay(i.data),
  },
  {
    key: "prezzo_totale",
    label: "Importo totale",
    category: "fattura",
    getValue: (i) => i.prezzo_totale,
  },
  {
    key: "mod_pag",
    label: "Modalità pagamento",
    category: "fattura",
    getValue: (i) => i.mod_pag,
  },
  { key: "citta", label: "Città", category: "fattura", getValue: (i) => i.citta },
  { key: "cap", label: "CAP", category: "fattura", getValue: (i) => i.cap },

  // Dati pagante/paziente letti dallo snapshot congelato all'emissione della
  // fattura (resolveAnagrafica), non dalle relazioni live: stessa fonte già
  // usata dal PDF (lib/pdf/placeholders.ts). Se una fattura non ha ancora uno
  // snapshot (fatture create prima di questo fix), resolveAnagrafica ricade
  // sulle relazioni live — comportamento identico a prima per quel caso.
  // Senza questo allineamento, il PDF e l'export Excel della stessa fattura
  // potevano mostrare indirizzi/CF diversi se l'anagrafica veniva modificata
  // dopo l'emissione.
  {
    key: "pagante_cognome_nome",
    label: "Pagante (cognome nome)",
    category: "pagante",
    getValue: (i) => {
      const { pagante } = resolveAnagrafica(i);
      return `${pagante.cognome} ${pagante.nome}`;
    },
  },
  {
    key: "pagante_via",
    label: "Via pagante",
    category: "pagante",
    getValue: (i) => resolveAnagrafica(i).pagante.via,
  },
  {
    key: "pagante_citta",
    label: "Città pagante",
    category: "pagante",
    getValue: (i) => resolveAnagrafica(i).pagante.citta,
  },
  {
    key: "pagante_cap",
    label: "CAP pagante",
    category: "pagante",
    getValue: (i) => resolveAnagrafica(i).pagante.cap,
  },
  {
    key: "pagante_cf",
    label: "CF pagante",
    category: "pagante",
    getValue: (i) => resolveAnagrafica(i).pagante.cf ?? "n/d",
  },
  {
    key: "pagante_piva",
    label: "P.IVA pagante",
    category: "pagante",
    getValue: (i) => resolveAnagrafica(i).pagante.piva ?? "n/d",
  },

  {
    key: "paziente_cognome_nome",
    label: "Paziente (cognome nome)",
    category: "paziente",
    getValue: (i) => {
      const { paziente } = resolveAnagrafica(i);
      return `${paziente.cognome} ${paziente.nome}`;
    },
  },

  {
    key: "sedute",
    label: "Sedute",
    category: "dettaglio",
    getValue: (i) => i.sedute ?? "n/d",
  },
  {
    key: "commento",
    label: "Commento",
    category: "dettaglio",
    getValue: (i) => i.commento ?? "n/d",
  },
  {
    key: "mesi",
    label: "Mesi",
    category: "dettaglio",
    getValue: (i) =>
      i.mesi.map((m) => `${m.mese}: ${formatCurrency(m.prezzo)}`).join(", "),
  },
  {
    key: "bollo_codice",
    label: "Codice marca da bollo",
    category: "dettaglio",
    getValue: (i) => i.bolloCodice ?? "n/d",
  },
  {
    key: "bollo_dovuto",
    label: "Bollo dovuto",
    category: "dettaglio",
    getValue: (i) => (i.prezzo_totale > SOGLIA_BOLLO ? "Sì" : "No"),
  },
  {
    key: "bollo_importo",
    label: "Importo marca da bollo",
    category: "dettaglio",
    getValue: (i) => getBolloImporto(i.bolloCodice),
  },
  {
    key: "prezzo_totale_con_bollo",
    label: "Totale con bollo",
    category: "dettaglio",
    getValue: (i) => getTotaleConBollo(i.prezzo_totale, i.bolloCodice),
  },
];

export const EXPORT_COLUMN_KEYS = EXPORT_COLUMNS.map((c) => c.key) as [
  string,
  ...string[],
];

export function getExportColumn(key: string): ExportColumn | undefined {
  return EXPORT_COLUMNS.find((c) => c.key === key);
}
