import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { propagaPaganteAlleBozze } from "./propaga-anagrafica";

describe("propagaPaganteAlleBozze (P021)", () => {
  const pagante = { nome: "Mario", cognome: "Rossi", via: "Via 1", citta: "Roma", cap: "00100", cf: "OLD", piva: null };
  const paziente = { nome: "Luigi", cognome: "Rossi" };

  it("fonde i campi passati nello snapshot di ogni bozza, anche senza snapshot salvato", async () => {
    const findMany = vi.fn(async () => [
      { id: 1, snapshotAnagrafica: { pagante, paziente }, pagante, paziente },
      { id: 2, snapshotAnagrafica: null, pagante: { ...pagante, id: 5 }, paziente: { ...paziente, cognome: "Bianchi" } },
    ]);
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const tx = { pagamento: { findMany, updateMany } } as unknown as Prisma.TransactionClient;

    await propagaPaganteAlleBozze(tx, { userId: 3, idPagante: 5, pagante: { cf: "NEW" }, escludiId: 9 });

    expect(findMany).toHaveBeenCalledWith({
      where: { id_Utente: 3, id_Pagante: 5, stato_ts: "DA_INVIARE", id: { not: 9 } },
      include: { pagante: true, paziente: true },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 1, id_Utente: 3, stato_ts: "DA_INVIARE" },
      data: { snapshotAnagrafica: { pagante: { ...pagante, cf: "NEW" }, paziente } },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 2, id_Utente: 3, stato_ts: "DA_INVIARE" },
      data: {
        snapshotAnagrafica: {
          pagante: { ...pagante, cf: "NEW" },
          paziente: { nome: "Luigi", cognome: "Bianchi" },
        },
      },
    });
  });
});
