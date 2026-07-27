import { prisma } from "@/lib/prisma";
import { getNextInvoiceNumberForUserYear } from "@/lib/data/invoices";
import { TEST_USER } from "./test-user";

async function getTestUserId(): Promise<number> {
  const utente = await prisma.utente.findUniqueOrThrow({
    where: { username: TEST_USER.username },
    select: { id: true },
  });
  return utente.id;
}

// Suffisso univoco per riconoscere ed eliminare in sicurezza le entità
// create da un singolo run di test, senza collidere tra run successivi.
export function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export async function createTestPayer(suffix: string) {
  const id_Utente = await getTestUserId();
  return prisma.pagante.create({
    data: {
      id_Utente,
      nome: `E2E${suffix}`,
      cognome: "PaganteTest",
      via: "Via dei Test 1",
      citta: "Roma",
      cap: "00100",
    },
  });
}

export async function createTestPatient(id_Pagante: number, suffix: string) {
  const id_Utente = await getTestUserId();
  return prisma.paziente.create({
    data: {
      id_Utente,
      id_Pagante,
      nome: `E2E${suffix}`,
      cognome: "PazienteTest",
    },
  });
}

export async function createTestInvoice(id_Pagante: number, id_Paziente: number) {
  const id_Utente = await getTestUserId();
  const anno = new Date().getFullYear();
  const n_fattura = await getNextInvoiceNumberForUserYear(id_Utente, anno);
  return prisma.pagamento.create({
    data: {
      id_Utente,
      id_Pagante,
      id_Paziente,
      prezzo_totale: 100,
      mod_pag: "CONTANTI",
      n_fattura,
      anno,
      data: new Date(),
      citta: "Roma",
      cap: "00100",
      mesi: { create: [{ mese: "GENNAIO", prezzo: 100 }] },
    },
  });
}

// Elimina in ordine: fatture (FK id_Pagante obbligatoria, vanno rimosse
// prima), pazienti collegati, poi il pagante. Esplicito invece di contare
// sul cascade DB di Paziente->Pagante per restare leggibile senza dover
// controllare lo schema.
export async function deleteTestPayerCascade(id_Pagante: number): Promise<void> {
  await prisma.pagamento.deleteMany({ where: { id_Pagante } });
  await prisma.paziente.deleteMany({ where: { id_Pagante } });
  await prisma.pagante.delete({ where: { id: id_Pagante } });
}
