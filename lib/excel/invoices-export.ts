import ExcelJS from "exceljs";
import { getExportColumn, type ExportableInvoice } from "./column-catalog";
import { sanitizeCellValue } from "./sanitize";

const CURRENCY_COLUMN_KEYS = new Set([
  "prezzo_totale",
  "bollo_importo",
  "prezzo_totale_con_bollo",
]);

export async function buildInvoicesWorkbook(
  invoices: ExportableInvoice[],
  columnKeys: string[]
): Promise<Buffer> {
  const columns = columnKeys
    .map((key) => getExportColumn(key))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Fatture");

  sheet.columns = columns.map((column) => ({
    header: column.label,
    key: column.key,
    width: Math.max(column.label.length + 2, 14),
  }));
  sheet.getRow(1).font = { bold: true };

  for (const invoice of invoices) {
    const row: Record<string, string | number> = {};
    for (const column of columns) {
      const value = column.getValue(invoice);
      row[column.key] =
        typeof value === "string" ? sanitizeCellValue(value) : value;
    }
    sheet.addRow(row);
  }

  for (const column of columns) {
    if (CURRENCY_COLUMN_KEYS.has(column.key)) {
      sheet.getColumn(column.key).numFmt = '#,##0.00 "€"';
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
