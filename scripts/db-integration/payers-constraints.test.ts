import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUniqueViolationOnField } from "@/lib/prisma-errors";
import { authContext } from "./auth-context";

vi.mock("@/lib/auth/session", () => ({
  requireUserId: vi.fn(async () => authContext.userId),
}));
vi.mock("@/lib/auth/client-ip", () => ({
  getClientIp: vi.fn(async () => "127.0.0.1"),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { archivePayer, hardDeletePayer } = await import("@/lib/actions/payers");

describe("indice unique parziale su paganti(cf) WHERE eliminato = false", () => {
  let utenteId: number;

  beforeAll(async () => {
    const utente = await prisma.utente.create({
      data: { username: `dbtest_cf_${Date.now()}`, passwordHash: "x" },
    });
    utenteId = utente.id;
    authContext.userId = utenteId;
  });

  afterAll(async () => {
    await prisma.pagante.deleteMany({ where: { id_Utente: utenteId } });
    await prisma.auditLog.deleteMany({ where: { id_Utente: utenteId } });
    await prisma.utente.delete({ where: { id: utenteId } });
  });

  // Bypassa deliberatamente checkPayerUniqueTaxIds (il pre-check applicativo
  // di createPayer/updatePayer, lib/actions/payers.ts) creando le righe
  // direttamente con Prisma: qui l'oggetto sotto test è l'indice Postgres
  // stesso — scritto a mano in prisma/migrations/20260720000000_init
  // (non esprimibile con @@unique nel DSL, vedi il commento sul model
  // Pagante in schema.prisma) — non la logica applicativa che normalmente
  // lo precede.
  it("rifiuta due paganti ATTIVI dello stesso utente con lo stesso cf", async () => {
    await prisma.pagante.create({
      data: {
        id_Utente: utenteId,
        nome: "Uno",
        cognome: "Attivo",
        via: "Via dei Test 1",
        citta: "Roma",
        cap: "00100",
        cf: "RSSMRA80A01H501U",
        archiviato: false,
      },
    });

    let caughtError: unknown;
    try {
      await prisma.pagante.create({
        data: {
          id_Utente: utenteId,
          nome: "Due",
          cognome: "Attivo",
          via: "Via dei Test 2",
          citta: "Roma",
          cap: "00100",
          cf: "RSSMRA80A01H501U",
          archiviato: false,
        },
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(isUniqueViolationOnField(caughtError, "cf")).toBe(true);
  });

  it("permette lo stesso cf su un pagante ATTIVO se l'unico altro con quel cf è ARCHIVIATO (archivia e ricrea)", async () => {
    const originale = await prisma.pagante.create({
      data: {
        id_Utente: utenteId,
        nome: "Originale",
        cognome: "DaArchiviare",
        via: "Via dei Test 3",
        citta: "Roma",
        cap: "00100",
        cf: "VRDLGU85B15H501W",
        archiviato: false,
      },
    });

    // archivePayer è la Server Action reale (non un update diretto): oltre a
    // verificare il comportamento dell'indice, conferma che l'archiviazione
    // fatta dall'action libera davvero il cf per un nuovo pagante attivo —
    // esattamente l'assunzione su cui si basa findRestoreConflict
    // (lib/archive/guards.ts) dal lato opposto (ripristino).
    const archiviato = await archivePayer(originale.id);
    expect(archiviato).toEqual({ success: true });

    const ricreato = await prisma.pagante.create({
      data: {
        id_Utente: utenteId,
        nome: "Ricreato",
        cognome: "StessoCf",
        via: "Via dei Test 4",
        citta: "Roma",
        cap: "00100",
        cf: "VRDLGU85B15H501W",
        archiviato: false,
      },
    });

    expect(ricreato.cf).toBe("VRDLGU85B15H501W");
  });
});

describe("hardDeletePayer: onDelete Cascade su pazienti", () => {
  let utenteId: number;

  beforeAll(async () => {
    const utente = await prisma.utente.create({
      data: { username: `dbtest_harddel_${Date.now()}`, passwordHash: "x" },
    });
    utenteId = utente.id;
    authContext.userId = utenteId;
  });

  afterAll(async () => {
    await prisma.paziente.deleteMany({ where: { id_Utente: utenteId } });
    await prisma.pagante.deleteMany({ where: { id_Utente: utenteId } });
    await prisma.auditLog.deleteMany({ where: { id_Utente: utenteId } });
    await prisma.utente.delete({ where: { id: utenteId } });
  });

  it("cancella in cascata solo i pazienti già archiviati del pagante eliminato, lasciando intatti quelli di altri paganti", async () => {
    const daEliminare = await prisma.pagante.create({
      data: {
        id_Utente: utenteId,
        nome: "Da",
        cognome: "Eliminare",
        via: "Via dei Test 5",
        citta: "Roma",
        cap: "00100",
        archiviato: true,
      },
    });
    const pazienteArchiviato = await prisma.paziente.create({
      data: {
        id_Utente: utenteId,
        id_Pagante: daEliminare.id,
        nome: "Paziente",
        cognome: "Archiviato",
        archiviato: true,
      },
    });

    const altroPagante = await prisma.pagante.create({
      data: {
        id_Utente: utenteId,
        nome: "Altro",
        cognome: "Pagante",
        via: "Via dei Test 6",
        citta: "Roma",
        cap: "00100",
      },
    });
    const pazienteAltrove = await prisma.paziente.create({
      data: {
        id_Utente: utenteId,
        id_Pagante: altroPagante.id,
        nome: "Paziente",
        cognome: "Altrove",
      },
    });

    const result = await hardDeletePayer(daEliminare.id);
    expect(result).toEqual({ success: true });

    const paganteDopo = await prisma.pagante.findUnique({ where: { id: daEliminare.id } });
    expect(paganteDopo).toBeNull();

    const pazienteArchiviatoDopo = await prisma.paziente.findUnique({
      where: { id: pazienteArchiviato.id },
    });
    expect(pazienteArchiviatoDopo).toBeNull();

    const pazienteAltroveDopo = await prisma.paziente.findUnique({
      where: { id: pazienteAltrove.id },
    });
    expect(pazienteAltroveDopo).not.toBeNull();
  });
});
