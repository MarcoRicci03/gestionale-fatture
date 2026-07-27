import { z } from "zod";
import { EXPORT_COLUMN_KEYS } from "@/lib/excel/column-catalog";
import { invoiceFiltersSchema } from "@/lib/validations/invoice-list-query";

// Limite id: protegge sia l'event loop Node (generazione workbook) sia la
// clausola IN() di Postgres da payload arbitrariamente grandi. Esportato
// così export-invoices-dialog.tsx può disabilitare la conferma oltre soglia
// usando lo stesso numero, ma la validazione qui è quella che conta davvero.
export const MAX_EXPORT_INVOICES = 2000;

const columnsSchema = z
  .array(z.enum(EXPORT_COLUMN_KEYS))
  .min(1)
  // .max(EXPORT_COLUMN_KEYS.length) impedisce un array con la stessa chiave
  // ripetuta un numero arbitrario di volte: senza un tetto,
  // buildInvoicesWorkbook (lib/excel/invoices-export.ts) costruiva un foglio
  // con altrettante colonne, saturando memoria ed event loop. La deduplica
  // successiva è comunque necessaria: un array già sotto soglia ma con
  // ripetizioni supererebbe il .max() solo se le ripetizioni bastano a
  // farlo, ma produrrebbe comunque colonne duplicate nel foglio esportato.
  .max(EXPORT_COLUMN_KEYS.length)
  .transform((cols) => Array.from(new Set(cols)));

// Due modalità di export: id espliciti (l'utente ha selezionato manualmente
// delle righe in InvoicesManager) oppure filtri (nessuna selezione: esporta
// tutto ciò che corrisponde ai filtri correnti, che dopo la paginazione
// LOG-05 possono corrispondere a più righe di quelle caricate lato client —
// vedi app/api/invoices/export/route.ts per la risoluzione server-side).
export const invoiceExportSchema = z.union([
  z.object({
    ids: z.array(z.number().int().positive()).min(1).max(MAX_EXPORT_INVOICES),
    columns: columnsSchema,
  }),
  z.object({
    filters: invoiceFiltersSchema,
    columns: columnsSchema,
  }),
]);

export type InvoiceExportInput = z.infer<typeof invoiceExportSchema>;
