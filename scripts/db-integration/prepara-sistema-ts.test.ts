import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { limiteEsclusivo, preparaDatiSistemaTs } from "../lib/prepara-sistema-ts.mjs";

// Correzione una tantum dei dati storici prima dell'uso del Sistema TS
// (scripts/prepara-sistema-ts.mjs), su un Postgres reale.
describe("prepara-sistema-ts", () => {
  let utente: number;
  const id: Record<string, number> = {};

  beforeAll(async () => {
    utente = (await prisma.utente.create({ data: { username: `dbtest_prep_${Date.now()}`, passwordHash: "x" } })).id;
    const pagante = await prisma.pagante.create({
      data: { id_Utente: utente, nome: "N", cognome: "C", via: "v", citta: "c", cap: "0", cf: "RSSMRA80A01H501U" },
    });
    const paziente = await prisma.paziente.create({
      data: { id_Utente: utente, id_Pagante: pagante.id, nome: "P", cognome: "Q" },
    });
    let n = 0;
    const fattura = (data: Date, extra: object = {}) =>
      prisma.pagamento.create({
        data: {
          id_Utente: utente,
          id_Pagante: pagante.id,
          id_Paziente: paziente.id,
          prezzo_totale: 100,
          mod_pag: "BONIFICO",
          n_fattura: ++n,
          anno: data.getFullYear(),
          data,
          citta: "c",
          cap: "0",
          // Stato lasciato dalle migration sulle righe esistenti.
          stato_ts: "DA_INVIARE",
          pagamento_tracciato: true,
          bollo: 0,
          ...extra,
        },
      });
    id.contanti2025 = (await fattura(new Date(2025, 5, 1, 12), { mod_pag: "CONTANTI" })).id;
    id.ultimoGiorno2025 = (await fattura(new Date(2025, 11, 31, 12), { bolloCodice: `9999${Date.now()}`.slice(0, 14) })).id;
    id.primoGiorno2026 = (await fattura(new Date(2026, 0, 1, 12), { mod_pag: "CONTANTI" })).id;
  });

  afterAll(async () => {
    await prisma.pagamento.deleteMany({ where: { id_Utente: utente } });
    await prisma.paziente.deleteMany({ where: { id_Utente: utente } });
    await prisma.pagante.deleteMany({ where: { id_Utente: utente } });
    await prisma.utente.delete({ where: { id: utente } });
  });

  const stato = (i: number) =>
    prisma.pagamento.findUniqueOrThrow({
      where: { id: i },
      select: { stato_ts: true, pagamento_tracciato: true, bollo: true },
    });

  it("rifiuta una data limite mancante o inesistente", () => {
    expect(limiteEsclusivo(undefined)).toBeNull();
    expect(limiteEsclusivo("31/12/2025")).toBeNull();
    expect(limiteEsclusivo("2025-02-30")).toBeNull();
  });

  it("in simulazione conta senza scrivere", async () => {
    const conteggi = await preparaDatiSistemaTs(prisma, { limite: limiteEsclusivo("2025-12-31"), apply: false });

    expect(conteggi.contantiNonTracciati).toBeGreaterThanOrEqual(2);
    expect(conteggi.giaInviate).toBeGreaterThanOrEqual(2);
    expect(await stato(id.contanti2025)).toMatchObject({ stato_ts: "DA_INVIARE", pagamento_tracciato: true });
  });

  it("applica le correzioni rispettando la data limite ed è idempotente", async () => {
    await preparaDatiSistemaTs(prisma, { limite: limiteEsclusivo("2025-12-31"), apply: true });

    expect(await stato(id.contanti2025)).toMatchObject({ stato_ts: "INVIATA", pagamento_tracciato: false });
    const ultimo2025 = await stato(id.ultimoGiorno2025);
    expect(ultimo2025.stato_ts).toBe("INVIATA");
    expect(ultimo2025.pagamento_tracciato).toBe(true);
    expect(ultimo2025.bollo.toNumber()).toBe(2);
    // Il 1° gennaio 2026 è oltre il limite: resta da inviare, ma i contanti si correggono.
    expect(await stato(id.primoGiorno2026)).toMatchObject({ stato_ts: "DA_INVIARE", pagamento_tracciato: false });

    const rilancio = await preparaDatiSistemaTs(prisma, { limite: limiteEsclusivo("2025-12-31"), apply: false });
    expect(rilancio).toEqual({ contantiNonTracciati: 0, bolloDaImpostare: 0, giaInviate: 0 });
  });
});
