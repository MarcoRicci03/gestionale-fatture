import { describe, expect, it } from "vitest";
import { buildPayerWhere } from "./list-query";

describe("buildPayerWhere", () => {
  it("senza ricerca: solo id_Utente e archiviato", () => {
    const where = buildPayerWhere(7, { search: "", archiviato: false });
    expect(where).toEqual({ AND: [{ id_Utente: 7 }, { archiviato: false }] });
  });

  it("archiviato: true per la lista archiviati", () => {
    const where = buildPayerWhere(7, { search: "", archiviato: true });
    expect(where).toEqual({ AND: [{ id_Utente: 7 }, { archiviato: true }] });
  });

  it("ricerca con un token: OR tra cognome, nome, cf, piva", () => {
    const where = buildPayerWhere(7, { search: "Rossi", archiviato: false });
    expect(where).toEqual({
      AND: [
        { id_Utente: 7 },
        { archiviato: false },
        {
          AND: [
            {
              OR: [
                { cognome: { contains: "Rossi", mode: "insensitive" } },
                { nome: { contains: "Rossi", mode: "insensitive" } },
                { cf: { contains: "Rossi", mode: "insensitive" } },
                { piva: { contains: "Rossi", mode: "insensitive" } },
              ],
            },
          ],
        },
      ],
    });
  });

  it("ricerca con due token: ogni token deve comparire (AND di due OR)", () => {
    const where = buildPayerWhere(7, { search: "Mario Rossi", archiviato: false });
    const searchClause = (where.AND as unknown[])[2] as { AND: unknown[] };
    expect(searchClause.AND).toHaveLength(2);
  });

  it("ricerca con soli spazi: nessuna clausola aggiunta", () => {
    const where = buildPayerWhere(7, { search: "   ", archiviato: false });
    expect(where).toEqual({ AND: [{ id_Utente: 7 }, { archiviato: false }] });
  });
});
