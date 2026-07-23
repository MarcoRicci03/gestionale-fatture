import { formatDateInput } from "@/lib/utils/date";

export type InvoiceFilters = {
  dataDa: string;
  dataA: string;
  persona: string;
  modPag: string;
  anno: string;
};

export const EMPTY_INVOICE_FILTERS: InvoiceFilters = {
  dataDa: "",
  dataA: "",
  persona: "",
  modPag: "",
  anno: "",
};

export function currentMonthInvoiceFilters(today: Date): InvoiceFilters {
  const y = today.getFullYear();
  const m = today.getMonth();
  return {
    ...EMPTY_INVOICE_FILTERS,
    dataDa: formatDateInput(new Date(y, m, 1)),
    dataA: formatDateInput(new Date(y, m + 1, 0)), // giorno 0 del mese successivo = ultimo giorno del mese corrente
  };
}
