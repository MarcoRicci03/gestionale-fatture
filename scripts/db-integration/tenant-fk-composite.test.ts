import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// P002: le FK composite (id, id_Utente) fanno rifiutare al DB stesso un
// collegamento tra record di utenti diversi, anche se un futuro bug
// applicativo saltasse i controlli di validateInvoiceRelations/createPatient.
describe("FK composite multi-tenant (P002)", () => {
  let utenteA: number;
  let utenteB: number;
  let paganteB: number;
  let pazienteA: number;
  let paganteA: number;

  beforeAll(async () => {
    const suffix = Date.now();
    utenteA = (await prisma.utente.create({ data: { username: `dbtest_fk_a_${suffix}`, passwordHash: "x" } })).id;
    utenteB = (await prisma.utente.create({ data: { username: `dbtest_fk_b_${suffix}`, passwordHash: "x" } })).id;
    const anagrafica = { nome: "N", cognome: "C", via: "Via 1", citta: "Roma", cap: "00100" };
    paganteA = (await prisma.pagante.create({ data: { id_Utente: utenteA, ...anagrafica } })).id;
    paganteB = (await prisma.pagante.create({ data: { id_Utente: utenteB, ...anagrafica } })).id;
    pazienteA = (
      await prisma.paziente.create({ data: { id_Utente: utenteA, id_Pagante: paganteA, nome: "P", cognome: "A" } })
    ).id;
  });

  afterAll(async () => {
    await prisma.pagamento.deleteMany({ where: { id_Utente: { in: [utenteA, utenteB] } } });
    await prisma.paziente.deleteMany({ where: { id_Utente: { in: [utenteA, utenteB] } } });
    await prisma.pagante.deleteMany({ where: { id_Utente: { in: [utenteA, utenteB] } } });
    await prisma.utente.deleteMany({ where: { id: { in: [utenteA, utenteB] } } });
  });

  function isFkViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
  }

  it("rifiuta un paziente collegato al pagante di un altro utente", async () => {
    const error = await prisma.paziente
      .create({ data: { id_Utente: utenteA, id_Pagante: paganteB, nome: "X", cognome: "Y" } })
      .catch((e: unknown) => e);
    expect(isFkViolation(error)).toBe(true);
  });

  it("rifiuta una fattura con pagante di un altro utente", async () => {
    const error = await prisma.pagamento
      .create({
        data: {
          id_Utente: utenteA,
          id_Pagante: paganteB,
          id_Paziente: pazienteA,
          data: new Date(2026, 0, 10, 12),
          anno: 2026,
          n_fattura: 1,
          prezzo_totale: 50,
          mod_pag: "BONIFICO",
          citta: "Roma",
          cap: "00100",
        },
      })
      .catch((e: unknown) => e);
    expect(isFkViolation(error)).toBe(true);
  });

  it("accetta i collegamenti dentro lo stesso utente", async () => {
    const fattura = await prisma.pagamento.create({
      data: {
        id_Utente: utenteA,
        id_Pagante: paganteA,
        id_Paziente: pazienteA,
        data: new Date(2026, 0, 10, 12),
        anno: 2026,
        n_fattura: 2,
        prezzo_totale: 50,
        mod_pag: "BONIFICO",
        citta: "Roma",
        cap: "00100",
      },
    });
    expect(fattura.id).toBeGreaterThan(0);
  });
});
