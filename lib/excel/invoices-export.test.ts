import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import type { Pagante, Paziente } from "@prisma/client";
import { buildInvoicesWorkbook } from "./invoices-export";
import type { ExportableInvoice } from "./column-catalog";

const PAGANTE: Pagante = {
  id: 1,
  id_Utente: 1,
  nome: "Mario",
  cognome: "=HYPERLINK(\"http://evil.example\",\"click\")",
  via: "Via Roma 1",
  citta: "Roma",
  cap: "00100",
  cf: null,
  piva: null,
  archiviato: false,
};

const PAZIENTE: Paziente = {
  id: 1,
  id_Utente: 1,
  id_Pagante: 1,
  nome: "Giulia",
  cognome: "Rossi",
  archiviato: false,
};

function baseInvoice(
  overrides: Partial<ExportableInvoice> = {}
): ExportableInvoice {
  return {
    id: 1,
    id_Utente: 1,
    id_Pagante: 1,
    id_Paziente: 1,
    prezzo_totale: 150,
    mod_pag: "BONIFICO",
    sedute: null,
    commento: "+1 seduta extra",
    n_fattura: 1,
    anno: 2026,
    data: new Date("2026-01-15"),
    citta: "Roma",
    cap: "00100",
    bolloCodice: null,
    pdfLayoutSnapshot: null,
    snapshotAnagrafica: null,
    pagante: PAGANTE,
    paziente: PAZIENTE,
    mesi: [],
    ...overrides,
  } as ExportableInvoice;
}

async function readCell(
  buffer: Buffer,
  row: number,
  col: number
): Promise<ExcelJS.CellValue> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook.getWorksheet("Fatture")!.getRow(row).getCell(col).value;
}

describe("buildInvoicesWorkbook — sanitizzazione anti formula-injection", () => {
  it("antepone un apice a un cognome pagante che inizia con '='", async () => {
    const invoice = baseInvoice();
    const buffer = await buildInvoicesWorkbook(
      [invoice],
      ["pagante_cognome_nome"]
    );

    const value = await readCell(buffer, 2, 1);
    expect(value).toBe(
      "'=HYPERLINK(\"http://evil.example\",\"click\") Mario"
    );
  });

  it("antepone un apice a un commento che inizia con '+'", async () => {
    const invoice = baseInvoice();
    const buffer = await buildInvoicesWorkbook([invoice], ["commento"]);

    const value = await readCell(buffer, 2, 1);
    expect(value).toBe("'+1 seduta extra");
  });

  it("lascia i valori numerici come numeri, non come stringa sanitizzata", async () => {
    const invoice = baseInvoice({ prezzo_totale: 150 });
    const buffer = await buildInvoicesWorkbook(
      [invoice],
      ["prezzo_totale"]
    );

    const value = await readCell(buffer, 2, 1);
    expect(value).toBe(150);
  });

  it("lascia invariato un valore senza prefisso pericoloso", async () => {
    const invoice = baseInvoice({
      paziente: { ...PAZIENTE, cognome: "Rossi", nome: "Giulia" },
    });
    const buffer = await buildInvoicesWorkbook(
      [invoice],
      ["paziente_cognome_nome"]
    );

    const value = await readCell(buffer, 2, 1);
    expect(value).toBe("Rossi Giulia");
  });

  it("non antepone un apostrofo al placeholder 'n/d' di un campo nullo", async () => {
    const invoice = baseInvoice({ bolloCodice: null });
    const buffer = await buildInvoicesWorkbook([invoice], ["bollo_codice"]);

    const value = await readCell(buffer, 2, 1);
    expect(value).toBe("n/d");
  });
});
