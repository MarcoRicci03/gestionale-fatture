import { z } from "zod";
import {
  currentMonthInvoiceFilters,
  type InvoiceFilters,
} from "@/components/invoices/invoice-filters";

export const invoiceFiltersSchema = z.object({
  dataDa: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  dataA: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  persona: z.string().max(200),
  modPag: z.union([z.literal(""), z.enum(["CONTANTI", "CARTA", "BONIFICO"])]),
  anno: z.union([z.literal(""), z.string().regex(/^\d{4}$/)]),
});

const pageSchema = z.coerce.number().int().positive();

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

// "f" marca una navigazione originata da un cambio filtro esplicito lato
// client (vedi InvoicesManager): solo così si distingue "nessun filtro
// impostato ancora" (applica il default mese corrente) da "l'utente ha
// svuotato ogni campo a mano" (mostra tutto, non il default). Il pulsante
// "Reset filtri" naviga all'URL nudo, senza "f", per tornare al default.
export function parseInvoiceListQuery(
  raw: RawSearchParams,
  today: Date
): { filters: InvoiceFilters; page: number } {
  let filters: InvoiceFilters;
  if (raw.f !== undefined) {
    const parsed = invoiceFiltersSchema.safeParse({
      dataDa: firstValue(raw.dataDa),
      dataA: firstValue(raw.dataA),
      persona: firstValue(raw.persona),
      modPag: firstValue(raw.modPag),
      anno: firstValue(raw.anno),
    });
    filters = parsed.success ? parsed.data : currentMonthInvoiceFilters(today);
  } else {
    filters = currentMonthInvoiceFilters(today);
  }

  const parsedPage = pageSchema.safeParse(firstValue(raw.page));
  const page = parsedPage.success ? parsedPage.data : 1;

  return { filters, page };
}
