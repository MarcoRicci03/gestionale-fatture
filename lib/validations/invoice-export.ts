import { z } from "zod";
import { EXPORT_COLUMN_KEYS } from "@/lib/excel/column-catalog";

// Limite id: protegge sia l'event loop Node (generazione workbook) sia la
// clausola IN() di Postgres da payload arbitrariamente grandi. Esportato
// così export-invoices-dialog.tsx può disabilitare la conferma oltre soglia
// usando lo stesso numero, ma la validazione qui è quella che conta davvero.
export const MAX_EXPORT_INVOICES = 2000;

export const invoiceExportSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(MAX_EXPORT_INVOICES),
  // .max(EXPORT_COLUMN_KEYS.length) impedisce un array con la stessa chiave
  // ripetuta un numero arbitrario di volte (nulla lo vietava prima, dato che
  // ogni singolo elemento è validato ma non l'array nel suo insieme): senza
  // un tetto, buildInvoicesWorkbook (lib/excel/invoices-export.ts) costruiva
  // un foglio con altrettante colonne, saturando memoria ed event loop. La
  // deduplica successiva è comunque necessaria: un array già sotto soglia ma
  // con ripetizioni (es. 2000 colonne tutte "n_fattura") supererebbe il
  // .max() solo se le ripetizioni bastano a farlo, ma produrrebbe comunque
  // colonne duplicate nel foglio esportato.
  columns: z
    .array(z.enum(EXPORT_COLUMN_KEYS))
    .min(1)
    .max(EXPORT_COLUMN_KEYS.length)
    .transform((cols) => Array.from(new Set(cols))),
});

export type InvoiceExportInput = z.infer<typeof invoiceExportSchema>;
