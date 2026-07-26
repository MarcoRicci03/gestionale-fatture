import { describe, it, expect } from "vitest";
import { invoiceExportSchema } from "../lib/validations/invoice-export";
import { EXPORT_COLUMN_KEYS } from "../lib/excel/column-catalog";

// `columns` era validato elemento per elemento (z.enum) ma senza tetto
// sull'array nel suo insieme: nulla vietava di ripetere una chiave valida un
// numero arbitrario di volte. Una POST a /api/invoices/export con una
// colonna ripetuta 200.000 volte superava la validazione e arrivava a
// buildInvoicesWorkbook (lib/excel/invoices-export.ts), che costruisce un
// foglio con altrettante colonne — DoS a costo di una singola richiesta,
// non attenuato dal rate limit (10/minuto) perché è il costo della SINGOLA
// richiesta a essere illimitato. Questo test verifica sia il tetto sia la
// deduplica.

const validColumn = EXPORT_COLUMN_KEYS[0];

it("rifiuta un array con più elementi delle chiavi disponibili", () => {
  const tooMany = Array.from(
    { length: EXPORT_COLUMN_KEYS.length + 1 },
    () => validColumn
  );
  const result = invoiceExportSchema.safeParse({ ids: [1], columns: tooMany });
  expect(result.success).toBe(false);
});

it("accetta un array grande quanto il numero di chiavi disponibili", () => {
  const exact = Array.from(
    { length: EXPORT_COLUMN_KEYS.length },
    () => validColumn
  );
  const result = invoiceExportSchema.safeParse({ ids: [1], columns: exact });
  expect(result.success).toBe(true);
});

it("deduplica le chiavi ripetute nel risultato validato", () => {
  const result = invoiceExportSchema.safeParse({
    ids: [1],
    columns: [validColumn, validColumn, validColumn],
  });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.columns).toEqual([validColumn]);
  }
});

it("rifiuta una chiave non valida", () => {
  const result = invoiceExportSchema.safeParse({
    ids: [1],
    columns: ["chiave_inesistente"],
  });
  expect(result.success).toBe(false);
});

it("rifiuta un array di colonne vuoto", () => {
  const result = invoiceExportSchema.safeParse({ ids: [1], columns: [] });
  expect(result.success).toBe(false);
});

describe("con tutte le chiavi distinte", () => {
  it("accetta l'intero catalogo senza duplicati", () => {
    const result = invoiceExportSchema.safeParse({
      ids: [1],
      columns: EXPORT_COLUMN_KEYS,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.columns).toHaveLength(EXPORT_COLUMN_KEYS.length);
    }
  });
});
