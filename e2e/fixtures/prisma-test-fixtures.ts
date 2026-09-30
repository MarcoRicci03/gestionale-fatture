import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/sistemats/vault";
import { TEST_USER } from "./test-user";

// Dati creati direttamente nel DB, così ogni spec prepara da sé lo stato che
// le serve (anche stati del Sistema TS che dalla UI si ottengono solo dopo un
// invio reale) senza dipendere da `npm run seed:dev`.

export async function getUserId(username: string = TEST_USER.username): Promise<number> {
  const utente = await prisma.utente.findUniqueOrThrow({
    where: { username },
    select: { id: true },
  });
  return utente.id;
}

export function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export async function createTestPayer(
  suffix: string,
  options: { username?: string; cf?: string | null } = {}
) {
  const id_Utente = await getUserId(options.username);
  return prisma.pagante.create({
    data: {
      id_Utente,
      nome: `E2E${suffix}`,
      cognome: "PaganteTest",
      via: "Via dei Test 1",
      citta: "Roma",
      cap: "00100",
      cf: options.cf ?? null,
    },
  });
}

export async function createTestPatient(id_Pagante: number, suffix: string) {
  // Stesso utente del pagante: le FK composite (P002) non ammettono altro.
  const { id_Utente } = await prisma.pagante.findUniqueOrThrow({
    where: { id: id_Pagante },
    select: { id_Utente: true },
  });
  return prisma.paziente.create({
    data: {
      id_Utente,
      id_Pagante,
      nome: `E2E${suffix}`,
      cognome: "PazienteTest",
    },
  });
}

// `overrides` permette di creare la fattura già in uno stato del Sistema TS
// (INVIATA, IN_TRASMISSIONE, ...) o con opposizione, importo, date diverse.
export async function createTestInvoice(
  id_Pagante: number,
  id_Paziente: number,
  overrides: Partial<Prisma.PagamentoUncheckedCreateInput> = {}
) {
  const { id_Utente } = await prisma.pagante.findUniqueOrThrow({
    where: { id: id_Pagante },
    select: { id_Utente: true },
  });
  const anno = new Date().getFullYear();
  const last = await prisma.pagamento.findFirst({
    where: { id_Utente, anno },
    orderBy: { n_fattura: "desc" },
    select: { n_fattura: true },
  });
  const n_fattura = (last?.n_fattura ?? 0) + 1;
  const prezzo = Number(overrides.prezzo_totale ?? 100);
  return prisma.pagamento.create({
    data: {
      id_Utente,
      id_Pagante,
      id_Paziente,
      prezzo_totale: prezzo,
      mod_pag: "CONTANTI",
      n_fattura,
      anno,
      data: new Date(),
      citta: "Roma",
      cap: "00100",
      mesi: { create: [{ mese: "GENNAIO", prezzo }] },
      ...overrides,
    },
  });
}

// Credenziali Sistema TS fittizie: bastano perché la UI consideri il Sistema
// TS configurato. Nessuno spec deve arrivare a chiamare Sogei.
export async function ensureTestTsSettings(username: string = TEST_USER.username): Promise<void> {
  const id_Utente = await getUserId(username);
  const data = {
    username: "E2ETESTUSER",
    passwordEncrypted: encryptCredential("e2e-password"),
    pincodeEncrypted: encryptCredential("e2e-pincode"),
  };
  await prisma.impostazioniSistemaTs.upsert({
    where: { id_Utente },
    update: data,
    create: { id_Utente, ...data },
  });
}

export async function createTestTrasmissione(
  invoiceIds: number[],
  options: { username?: string; protocollo: string; pdfRicevuta?: Uint8Array<ArrayBuffer> }
) {
  const id_Utente = await getUserId(options.username);
  return prisma.trasmissioneTs.create({
    data: {
      id_Utente,
      protocollo: options.protocollo,
      nomeFile: `invio_${options.protocollo}.zip`,
      statoElaborazione: "2",
      pdfRicevuta: options.pdfRicevuta,
      fatture: { connect: invoiceIds.map((id) => ({ id })) },
    },
  });
}

export async function deleteTestPayerCascade(id_Pagante: number): Promise<void> {
  const fatture = await prisma.pagamento.findMany({
    where: { id_Pagante },
    select: { id: true, protocollo_ts: true },
  });
  const protocolli = fatture.map((f) => f.protocollo_ts).filter((p): p is string => p !== null);
  if (protocolli.length > 0) {
    await prisma.trasmissioneTs.deleteMany({ where: { protocollo: { in: protocolli } } });
  }
  await prisma.pagamento.deleteMany({ where: { id_Pagante } });
  await prisma.paziente.deleteMany({ where: { id_Pagante } });
  await prisma.pagante.delete({ where: { id: id_Pagante } });
}
