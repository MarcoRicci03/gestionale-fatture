import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUniqueViolationOnField } from "@/lib/prisma-errors";

// QUA-04: due proprietà di basso livello su cui l'intero data layer si
// affida implicitamente, mai verificate contro un Postgres reale.
// Deliberatamente non passano dalle Server Action esportate (vedi invece
// scripts/db-integration/invoices-cascade.test.ts e
// payers-constraints.test.ts per quello): qui l'oggetto sotto test è il
// meccanismo di Prisma stesso (transazione interattiva, scrittura nidificata
// su una relazione) con l'adapter @prisma/adapter-pg usato da questo
// progetto al posto dell'engine binario di default — un adapter diverso
// potrebbe in teoria comportarsi diversamente, e nessun test esistente lo
// esercita contro un database vero.
describe("garanzie di atomicità di Prisma verificate contro Postgres reale", () => {
  let utenteId: number;

  beforeAll(async () => {
    const utente = await prisma.utente.create({
      data: { username: `dbtest_tx_${Date.now()}`, passwordHash: "x" },
    });
    utenteId = utente.id;
  });

  afterAll(async () => {
    await prisma.fatturaMese.deleteMany({
      where: { pagamento: { id_Utente: utenteId } },
    });
    await prisma.pagamento.deleteMany({ where: { id_Utente: utenteId } });
    await prisma.paziente.deleteMany({ where: { id_Utente: utenteId } });
    await prisma.pagante.deleteMany({ where: { id_Utente: utenteId } });
    await prisma.utente.delete({ where: { id: utenteId } });
  });

  it("prisma.$transaction annulla TUTTE le scritture precedenti se un passo successivo lancia (pattern di archivePayer/restorePayer)", async () => {
    const pagante = await prisma.pagante.create({
      data: {
        id_Utente: utenteId,
        nome: "Tx",
        cognome: "Test",
        via: "Via dei Test 1",
        citta: "Roma",
        cap: "00100",
      },
    });
    const paziente = await prisma.paziente.create({
      data: { id_Utente: utenteId, id_Pagante: pagante.id, nome: "Tx", cognome: "Paziente" },
    });

    // Stessa forma esatta della transazione in archivePayer (lib/actions/payers.ts):
    // update sul pagante, poi updateMany a cascata sui suoi pazienti. Qui il
    // guasto è forzato con un throw esplicito subito dopo, invece che da un
    // vincolo DB naturale (nessun campo toccato da queste due scritture può
    // violarne uno) — l'obiettivo è verificare che l'adapter rispetti
    // comunque il rollback, non replicare uno scenario di errore specifico.
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.pagante.update({
          where: { id: pagante.id },
          data: { archiviato: true },
        });
        await tx.paziente.updateMany({
          where: { id_Utente: utenteId, id_Pagante: pagante.id, archiviato: false },
          data: { archiviato: true, archiviatoInCascata: true },
        });
        throw new Error("guasto simulato dopo le due scritture");
      })
    ).rejects.toThrow("guasto simulato");

    const paganteDopo = await prisma.pagante.findUniqueOrThrow({ where: { id: pagante.id } });
    const pazienteDopo = await prisma.paziente.findUniqueOrThrow({ where: { id: paziente.id } });
    expect(paganteDopo.archiviato).toBe(false);
    expect(pazienteDopo.archiviato).toBe(false);
    expect(pazienteDopo.archiviatoInCascata).toBe(false);
  });

  it("un update() con scrittura nidificata deleteMany+create sui mesi resta atomico se il vincolo unique su bolloCodice fallisce (pattern di updateInvoice)", async () => {
    const pagante = await prisma.pagante.create({
      data: {
        id_Utente: utenteId,
        nome: "Bollo",
        cognome: "Test",
        via: "Via dei Test 1",
        citta: "Roma",
        cap: "00100",
      },
    });
    const paziente = await prisma.paziente.create({
      data: { id_Utente: utenteId, id_Pagante: pagante.id, nome: "Bollo", cognome: "Paziente" },
    });

    const invoice1 = await prisma.pagamento.create({
      data: {
        id_Utente: utenteId,
        id_Pagante: pagante.id,
        id_Paziente: paziente.id,
        prezzo_totale: 100,
        mod_pag: "CONTANTI",
        n_fattura: 1,
        anno: 2024,
        data: new Date("2024-01-10"),
        citta: "Roma",
        cap: "00100",
        bolloCodice: "11111111111111",
        mesi: { create: [{ mese: "GENNAIO", prezzo: 100 }] },
      },
    });
    await prisma.pagamento.create({
      data: {
        id_Utente: utenteId,
        id_Pagante: pagante.id,
        id_Paziente: paziente.id,
        prezzo_totale: 200,
        mod_pag: "CONTANTI",
        n_fattura: 2,
        anno: 2024,
        data: new Date("2024-02-10"),
        citta: "Roma",
        cap: "00100",
        bolloCodice: "22222222222222",
        mesi: { create: [{ mese: "FEBBRAIO", prezzo: 200 }] },
      },
    });

    // updateInvoice (lib/actions/invoices.ts) fa un pre-check applicativo
    // (isBolloCodiceTaken) che normalmente intercetta questo caso prima di
    // arrivare qui — è per questo che questo test chiama prisma direttamente
    // con lo stesso identico payload nidificato dell'update() di
    // updateInvoice, invece di passare dall'action: solo così si forza
    // deterministicamente il vincolo DB (l'unica vera rete di sicurezza
    // sotto una race condition tra due richieste concorrenti) a fallire, e
    // si verifica che il fallimento non lasci i mesi a metà sostituiti.
    let caughtError: unknown;
    try {
      await prisma.pagamento.update({
        where: { id: invoice1.id },
        data: {
          bolloCodice: "22222222222222",
          mesi: {
            deleteMany: {},
            create: [{ mese: "MARZO", prezzo: 999 }],
          },
        },
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(isUniqueViolationOnField(caughtError, "bolloCodice")).toBe(true);

    const invoice1Dopo = await prisma.pagamento.findUniqueOrThrow({
      where: { id: invoice1.id },
      include: { mesi: true },
    });
    expect(invoice1Dopo.bolloCodice).toBe("11111111111111");
    expect(invoice1Dopo.mesi).toHaveLength(1);
    expect(invoice1Dopo.mesi[0].mese).toBe("GENNAIO");
    expect(invoice1Dopo.mesi[0].prezzo.toNumber()).toBe(100);
  });
});
