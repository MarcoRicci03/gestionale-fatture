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
  archiviatoInCascata: false,
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
    stato_ts: "INVIATA",
    protocollo_ts: null,
    protocollo_cancellazione_ts: null,
    data_invio_ts: null,
    flag_opposizione: false,
    pagamento_tracciato: true,
    natura_iva: "N2.2",
    bollo: 0 as unknown as ExportableInvoice["bollo"],
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

describe("buildInvoicesWorkbook — colonne bollo_importo / prezzo_totale_con_bollo", () => {
  it("con bolloCodice presente, produce celle numeriche con il bollo sommato", async () => {
    const invoice = baseInvoice({
      prezzo_totale: 100,
      bolloCodice: "01234567890123",
    });
    const buffer = await buildInvoicesWorkbook(
      [invoice],
      ["bollo_importo", "prezzo_totale_con_bollo"]
    );

    expect(await readCell(buffer, 2, 1)).toBe(2);
    expect(await readCell(buffer, 2, 2)).toBe(102);
  });

  it("applica il formato valuta anche alle nuove colonne, non solo a prezzo_totale", async () => {
    const invoice = baseInvoice({ prezzo_totale: 100, bolloCodice: "01234567890123" });
    const buffer = await buildInvoicesWorkbook(
      [invoice],
      ["prezzo_totale", "bollo_importo", "prezzo_totale_con_bollo"]
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet("Fatture")!;

    // Indice numerico di colonna (1-based, stesso ordine di columnKeys), non
    // la key stringa: il round-trip su XLSX reale non conserva la mappatura
    // per key di exceljs (esiste solo in memoria prima del salvataggio), solo
    // header/posizione/stile sopravvivono al reload da buffer.
    expect(sheet.getColumn(1).numFmt).toBe('#,##0.00 "€"');
    expect(sheet.getColumn(2).numFmt).toBe('#,##0.00 "€"');
    expect(sheet.getColumn(3).numFmt).toBe('#,##0.00 "€"');
  });
});

describe("buildInvoicesWorkbook — colonna stato_ts e gestione ANNULLATA_TS", () => {
  it("esporta correttamente le etichette per i vari stati TS", async () => {
    const invDaInviare = baseInvoice({ id: 1, stato_ts: "DA_INVIARE" });
    const invInviata = baseInvoice({ id: 2, stato_ts: "INVIATA" });
    const invAnnullata = baseInvoice({ id: 3, stato_ts: "ANNULLATA_TS" });

    const buffer = await buildInvoicesWorkbook(
      [invDaInviare, invInviata, invAnnullata],
      ["n_fattura", "stato_ts"]
    );

    expect(await readCell(buffer, 2, 2)).toBe("Da inviare");
    expect(await readCell(buffer, 3, 2)).toBe("Inviata");
    expect(await readCell(buffer, 4, 2)).toBe("Annullata");
  });

  it("azzera prezzo_totale, bollo_importo e prezzo_totale_con_bollo per ANNULLATA_TS", async () => {
    const invAnnullata = baseInvoice({
      prezzo_totale: 150,
      bolloCodice: "01234567890123",
      stato_ts: "ANNULLATA_TS",
    });

    const buffer = await buildInvoicesWorkbook(
      [invAnnullata],
      [
        "prezzo_totale",
        "bollo_dovuto",
        "bollo_importo",
        "prezzo_totale_con_bollo",
        "stato_ts",
      ]
    );

    // prezzo_totale deve essere 0 numerico
    expect(await readCell(buffer, 2, 1)).toBe(0);
    // bollo_dovuto indica che è annullata
    expect(await readCell(buffer, 2, 2)).toBe("No (annullata)");
    // bollo_importo deve essere 0
    expect(await readCell(buffer, 2, 3)).toBe(0);
    // prezzo_totale_con_bollo deve essere 0
    expect(await readCell(buffer, 2, 4)).toBe(0);
    // stato_ts deve essere 'Annullata'
    expect(await readCell(buffer, 2, 5)).toBe("Annullata");
  });

  it("mantiene gli importi reali per le fatture attive (non ANNULLATA_TS)", async () => {
    const invAttiva = baseInvoice({
      prezzo_totale: 150,
      bolloCodice: "01234567890123",
      stato_ts: "INVIATA",
    });

    const buffer = await buildInvoicesWorkbook(
      [invAttiva],
      [
        "prezzo_totale",
        "bollo_dovuto",
        "bollo_importo",
        "prezzo_totale_con_bollo",
      ]
    );

    expect(await readCell(buffer, 2, 1)).toBe(150);
    expect(await readCell(buffer, 2, 2)).toBe("Sì");
    expect(await readCell(buffer, 2, 3)).toBe(2);
    expect(await readCell(buffer, 2, 4)).toBe(152);
  });
});

