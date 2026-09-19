import type { FatturaInTrasmissioneItem } from "@/lib/data/sistema-ts";

export type TrasmissioneItem = {
  id: number;
  tipo?: string;
  protocollo: string;
  nomeFile: string;
  dataInvio: Date;
  statoElaborazione: string | null;
  codiceEsito: string | null;
  descrizioneEsito: string | null;
  numRicevuti: number | null;
  numAccolti: number | null;
  numScartati: number | null;
  hasPdfRicevuta: boolean;
  hasCsvErrori: boolean;
  csvErrori?: string | null;
  totaleFatture: number;
  fatture: FatturaInTrasmissioneItem[];
};

export type CancelInvoiceData = {
  id: number;
  n_fattura: number;
  anno: number;
  data: Date;
  paganteNome: string;
};

export type ReadinessFilter = "pronte" | "da_correggere" | "future" | "tutte";

export function formatCurrency(val: number): string {
  return val.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
