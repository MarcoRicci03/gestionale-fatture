import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { authContext } from "./auth-context";

// requireUserId/getClientIp dipendono da next/headers (cookies()/headers()),
// disponibile solo dentro una richiesta Next.js reale: qui si sostituisce
// solo questo confine, così createInvoice/deleteInvoice restano le vere
// Server Action esportate da lib/actions/invoices.ts, eseguite per intero
// (incluse le loro transazioni e query) contro Postgres.
vi.mock("@/lib/auth/session", () => ({
  requireUserId: vi.fn(async () => authContext.userId),
}));
vi.mock("@/lib/auth/client-ip", () => ({
  getClientIp: vi.fn(async () => "127.0.0.1"),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { createInvoice, deleteInvoice } = await import("@/lib/actions/invoices");

// QUA-04: deleteInvoice cancella fisicamente la fattura (LOG-03) dentro una
// transazione che scrive anche l'evento di audit. FatturaMese ha
// `onDelete: Cascade` verso Pagamento (schema.prisma) — mai verificato che,
// chiamando la Server Action reale contro un database vero, i mesi
// collegati spariscano davvero insieme alla fattura invece di restare come
// righe orfane.
describe("deleteInvoice: onDelete Cascade su fattura_mesi", () => {
  let utenteId: number;
  let paganteId: number;
  let pazienteId: number;

  beforeAll(async () => {
    const utente = await prisma.utente.create({
      data: { username: `dbtest_invcasc_${Date.now()}`, passwordHash: "x" },
    });
    utenteId = utente.id;
    authContext.userId = utenteId;

    const pagante = await prisma.pagante.create({
      data: {
        id_Utente: utenteId,
        nome: "Cascade",
        cognome: "Test",
        via: "Via dei Test 1",
        citta: "Roma",
        cap: "00100",
      },
    });
    paganteId = pagante.id;

    const paziente = await prisma.paziente.create({
      data: { id_Utente: utenteId, id_Pagante: paganteId, nome: "Cascade", cognome: "Paziente" },
    });
    pazienteId = paziente.id;
  });

  afterAll(async () => {
    await prisma.fatturaMese.deleteMany({ where: { pagamento: { id_Utente: utenteId } } });
    await prisma.pagamento.deleteMany({ where: { id_Utente: utenteId } });
    await prisma.auditLog.deleteMany({ where: { id_Utente: utenteId } });
    await prisma.paziente.deleteMany({ where: { id_Utente: utenteId } });
    await prisma.pagante.deleteMany({ where: { id_Utente: utenteId } });
    await prisma.utente.delete({ where: { id: utenteId } });
  });

  it("cancella la fattura e in cascata tutte le sue righe fattura_mesi", async () => {
    const created = await createInvoice({
      id_Pagante: paganteId,
      id_Paziente: pazienteId,
      data: new Date("2024-01-10"),
      mod_pag: "CONTANTI",
      n_fattura: 1,
      mesi: [
        { mese: "GENNAIO", prezzo: 100 },
        { mese: "FEBBRAIO", prezzo: 150 },
      ],
      citta: "Roma",
      cap: "00100",
    });
    expect(created).toEqual({ success: true });

    const invoice = await prisma.pagamento.findFirstOrThrow({
      where: { id_Utente: utenteId, n_fattura: 1, anno: 2024 },
    });
    const mesiPrima = await prisma.fatturaMese.findMany({ where: { id_Pagamento: invoice.id } });
    expect(mesiPrima).toHaveLength(2);

    const result = await deleteInvoice(invoice.id);
    expect(result).toEqual({ success: true });

    const invoiceDopo = await prisma.pagamento.findUnique({ where: { id: invoice.id } });
    expect(invoiceDopo).toBeNull();

    const mesiDopo = await prisma.fatturaMese.findMany({ where: { id_Pagamento: invoice.id } });
    expect(mesiDopo).toHaveLength(0);
  });
});
