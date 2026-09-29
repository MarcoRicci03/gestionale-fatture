import { describe, expect, it } from "vitest";
import { buildInvoiceWhere } from "./list-query";
import { parseDateInput } from "@/lib/utils/date";
import { EMPTY_INVOICE_FILTERS } from "@/components/invoices/invoice-filters";

describe("buildInvoiceWhere", () => {
  it("senza filtri: solo id_Utente", () => {
    const where = buildInvoiceWhere(7, EMPTY_INVOICE_FILTERS);
    expect(where).toEqual({ AND: [{ id_Utente: 7 }] });
  });

  it("dataDa/dataA: intervallo gte/lte su parseDateInput", () => {
    const where = buildInvoiceWhere(7, {
      ...EMPTY_INVOICE_FILTERS,
      dataDa: "2026-01-01",
      dataA: "2026-01-31",
    });
    expect(where).toEqual({
      AND: [
        { id_Utente: 7 },
        {
          data: {
            gte: parseDateInput("2026-01-01"),
            lte: parseDateInput("2026-01-31"),
          },
        },
      ],
    });
  });

  it("solo dataDa: nessun lte nella clausola data", () => {
    const where = buildInvoiceWhere(7, { ...EMPTY_INVOICE_FILTERS, dataDa: "2026-01-01" });
    expect(where).toEqual({
      AND: [{ id_Utente: 7 }, { data: { gte: parseDateInput("2026-01-01") } }],
    });
  });

  it("anno: filtro numerico esatto", () => {
    const where = buildInvoiceWhere(7, { ...EMPTY_INVOICE_FILTERS, anno: "2025" });
    expect(where).toEqual({ AND: [{ id_Utente: 7 }, { anno: 2025 }] });
  });

  it("modPag valido: filtro su mod_pag", () => {
    const where = buildInvoiceWhere(7, { ...EMPTY_INVOICE_FILTERS, modPag: "BONIFICO" });
    expect(where).toEqual({ AND: [{ id_Utente: 7 }, { mod_pag: "BONIFICO" }] });
  });

  it("modPag non valido (URL manomesso): viene ignorato, non genera un where rotto", () => {
    const where = buildInvoiceWhere(7, {
      ...EMPTY_INVOICE_FILTERS,
      modPag: "PAYPAL" as never,
    });
    expect(where).toEqual({ AND: [{ id_Utente: 7 }] });
  });

  it("persona con un token: OR tra cognome/nome di pagante e paziente", () => {
    const where = buildInvoiceWhere(7, { ...EMPTY_INVOICE_FILTERS, persona: "Rossi" });
    expect(where).toEqual({
      AND: [
        { id_Utente: 7 },
        {
          AND: [
            {
              OR: [
                {
                  pagante: {
                    is: {
                      OR: [
                        { cognome: { contains: "Rossi", mode: "insensitive" } },
                        { nome: { contains: "Rossi", mode: "insensitive" } },
                      ],
                    },
                  },
                },
                {
                  paziente: {
                    is: {
                      OR: [
                        { cognome: { contains: "Rossi", mode: "insensitive" } },
                        { nome: { contains: "Rossi", mode: "insensitive" } },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("persona con due token: ogni token deve comparire (AND di due OR)", () => {
    const where = buildInvoiceWhere(7, { ...EMPTY_INVOICE_FILTERS, persona: "Mario Rossi" });
    const personaClause = (where.AND as unknown[])[1] as { AND: unknown[] };
    expect(personaClause.AND).toHaveLength(2);
  });

  it("persona con soli spazi: nessuna clausola aggiunta", () => {
    const where = buildInvoiceWhere(7, { ...EMPTY_INVOICE_FILTERS, persona: "   " });
    expect(where).toEqual({ AND: [{ id_Utente: 7 }] });
  });
});
