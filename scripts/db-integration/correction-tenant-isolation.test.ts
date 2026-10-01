import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { correggiFatturaTsService } from "@/lib/sistemats/services/correction.service";

// Isolamento multi-tenant di correggiFatturaTsService: un utente B non deve
// poter modificare il pagante di un utente A. Il service è chiamato
// direttamente con userId esplicito, quindi non serve mockare la sessione.
describe("correggiFatturaTsService: isolamento tra utenti", () => {
  const CF_ORIGINALE = "VRDLGU85B15H501W";
  const CF_NUOVO = "RSSMRA80A01H501U";

  let utenteA: number;
  let utenteB: number;
  let paganteA: number;
  let fatturaA: number;

  async function createPagamento(id_Utente: number, id_Pagante: number, id_Paziente: number) {
    return prisma.pagamento.create({
      data: {
        id_Utente,
        id_Pagante,
        id_Paziente,
        prezzo_totale: 100,
        mod_pag: "CONTANTI",
        n_fattura: 1,
        anno: 2024,
        data: new Date(2024, 0, 10, 12),
        citta: "Roma",
        cap: "00100",
      },
    });
  }

  beforeAll(async () => {
    const suffix = Date.now();
    utenteA = (
      await prisma.utente.create({
        data: { username: `dbtest_corrA_${suffix}`, passwordHash: "x" },
      })
    ).id;
    utenteB = (
      await prisma.utente.create({
        data: { username: `dbtest_corrB_${suffix}`, passwordHash: "x" },
      })
    ).id;

    paganteA = (
      await prisma.pagante.create({
        data: {
          id_Utente: utenteA,
          nome: "Anna",
          cognome: "Tenant",
          via: "Via dei Test 1",
          citta: "Roma",
          cap: "00100",
          cf: CF_ORIGINALE,
        },
      })
    ).id;
    const pazienteA = await prisma.paziente.create({
      data: { id_Utente: utenteA, id_Pagante: paganteA, nome: "Anna", cognome: "Paziente" },
    });
    fatturaA = (await createPagamento(utenteA, paganteA, pazienteA.id)).id;
  });

  afterAll(async () => {
    const utenti = [utenteA, utenteB];
    await prisma.pagamento.deleteMany({ where: { id_Utente: { in: utenti } } });
    await prisma.paziente.deleteMany({ where: { id_Utente: { in: utenti } } });
    await prisma.pagante.deleteMany({ where: { id_Utente: { in: utenti } } });
    await prisma.utente.deleteMany({ where: { id: { in: utenti } } });
  });

  async function cfPaganteA() {
    const pagante = await prisma.pagante.findUniqueOrThrow({ where: { id: paganteA } });
    return pagante.cf;
  }

  it("B non trova la fattura di A e il pagante di A resta invariato", async () => {
    const result = await correggiFatturaTsService({
      userId: utenteB,
      data: {
        invoiceId: fatturaA,
        paganteCf: CF_NUOVO,
        aggiornaAnagrafica: true,
        propagaFattureInAttesa: false,
      },
    });

    expect(result).toEqual({ success: false, error: "Fattura non trovata." });
    expect(await cfPaganteA()).toBe(CF_ORIGINALE);
  });

  // Una fattura di B collegata al pagante di A non si può più creare: le FK
  // composite (id, id_Utente) introdotte con P002 la rifiutano nel DB, quindi
  // il service non può ricevere una fattura "ponte" verso il pagante di A.
  it("il DB rifiuta una fattura di B collegata al pagante di A", async () => {
    const pagante = await prisma.pagante.create({
      data: {
        id_Utente: utenteB,
        nome: "Bruno",
        cognome: "Tenant",
        via: "Via dei Test 2",
        citta: "Roma",
        cap: "00100",
      },
    });
    const paziente = await prisma.paziente.create({
      data: { id_Utente: utenteB, id_Pagante: pagante.id, nome: "Bruno", cognome: "Paziente" },
    });

    const error = await createPagamento(utenteB, paganteA, paziente.id).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: "P2003" });
    expect(await cfPaganteA()).toBe(CF_ORIGINALE);
  });
});
