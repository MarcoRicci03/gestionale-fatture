import { z } from "zod";
import { EXPORT_COLUMN_KEYS } from "@/lib/excel/column-catalog";

// Limite id: protegge sia l'event loop Node (generazione workbook) sia la
// clausola IN() di Postgres da payload arbitrariamente grandi. Esportato
// così export-invoices-dialog.tsx può disabilitare la conferma oltre soglia
// usando lo stesso numero, ma la validazione qui è quella che conta davvero.
export const MAX_EXPORT_INVOICES = 2000;

export const invoiceExportSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(MAX_EXPORT_INVOICES),
  columns: z.array(z.enum(EXPORT_COLUMN_KEYS)).min(1),
});

export type InvoiceExportInput = z.infer<typeof invoiceExportSchema>;
