import type { FatturaMese, Pagamento, Pagante, Paziente } from "@prisma/client";
import { formatDateDisplay } from "@/lib/utils/date";
import { SOGLIA_BOLLO } from "@/lib/constants/bollo";

// Stessa forma prodotta da getInvoices()/getInvoiceById() (lib/data/invoices.ts):
// Decimal già convertiti a number, relazioni incluse.
export type ExportableInvoice = Omit<Pagamento, "prezzo_totale"> & {
  prezzo_totale: number;
  mesi: (Omit<FatturaMese, "prezzo"> & { prezzo: number })[];
  pagante: Pagante | null;
  paziente: Paziente | null;
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

  {
    key: "pagante_cognome_nome",
    label: "Pagante (cognome nome)",
    category: "pagante",
    getValue: (i) =>
      i.pagante ? `${i.pagante.cognome} ${i.pagante.nome}` : "-",
  },
  {
    key: "pagante_via",
    label: "Via pagante",
    category: "pagante",
    getValue: (i) => i.pagante?.via ?? "-",
  },
  {
    key: "pagante_citta",
    label: "Città pagante",
    category: "pagante",
    getValue: (i) => i.pagante?.citta ?? "-",
  },
  {
    key: "pagante_cap",
    label: "CAP pagante",
    category: "pagante",
    getValue: (i) => i.pagante?.cap ?? "-",
  },
  {
    key: "pagante_cf",
    label: "CF pagante",
    category: "pagante",
    getValue: (i) => i.pagante?.cf ?? "-",
  },
  {
    key: "pagante_piva",
    label: "P.IVA pagante",
    category: "pagante",
    getValue: (i) => i.pagante?.piva ?? "-",
  },

  {
    key: "paziente_cognome_nome",
    label: "Paziente (cognome nome)",
    category: "paziente",
    getValue: (i) =>
      i.paziente ? `${i.paziente.cognome} ${i.paziente.nome}` : "-",
  },

  {
    key: "sedute",
    label: "Sedute",
    category: "dettaglio",
    getValue: (i) => i.sedute ?? "-",
  },
  {
    key: "commento",
    label: "Commento",
    category: "dettaglio",
    getValue: (i) => i.commento ?? "-",
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
    getValue: (i) => i.bolloCodice ?? "-",
  },
  {
    key: "bollo_dovuto",
    label: "Bollo dovuto",
    category: "dettaglio",
    getValue: (i) => (i.prezzo_totale > SOGLIA_BOLLO ? "Sì" : "No"),
  },
];

export const EXPORT_COLUMN_KEYS = EXPORT_COLUMNS.map((c) => c.key) as [
  string,
  ...string[],
];

export function getExportColumn(key: string): ExportColumn | undefined {
  return EXPORT_COLUMNS.find((c) => c.key === key);
}
