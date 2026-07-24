"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { Pagante, Paziente } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/client-ip";
import { getPdfSettingsForUser } from "@/lib/data/settings";
import { invoiceSchema, type InvoiceFormData } from "@/lib/validations/invoice";
import { isUniqueViolationOnField } from "@/lib/prisma-errors";
import {
  getNextInvoiceNumberForUserYear,
  getChronologyNeighbors,
} from "@/lib/data/invoices";
import {
  findChronologyConflict,
  formatChronologyConflictMessage,
} from "@/lib/invoices/chronology";
import { buildSnapshotAnagrafica } from "@/lib/invoices/anagrafica-snapshot";
import { logAudit } from "@/lib/audit/log";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

const BOLLO_CODICE_DUPLICATO_ERROR =
  "Il codice della marca da bollo è già stato utilizzato su un'altra fattura";

function isBolloCodiceUniqueViolation(error: unknown): boolean {
  return isUniqueViolationOnField(error, "bolloCodice");
}

function isInvoiceNumberUniqueViolation(error: unknown): boolean {
  return isUniqueViolationOnField(error, "n_fattura");
}

export type InvoiceActionState = { success: true } | { error: string };

async function isInvoiceNumberTaken(
  userId: number,
  n_fattura: number,
  year: number,
  excludeId?: number
): Promise<boolean> {
  const existing = await prisma.pagamento.findFirst({
    where: {
      id_Utente: userId,
      n_fattura,
      anno: year,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  return existing !== null;
}

async function isBolloCodiceTaken(
  bolloCodice: string,
  excludeId?: number
): Promise<boolean> {
  const userId = await requireUserId();
  const existing = await prisma.pagamento.findFirst({
    where: {
      id_Utente: userId,
      bolloCodice,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  return existing !== null;
}

type RelationValidationResult =
  | { error: string }
  | { payer: Pagante; patient: Paziente };

async function validateInvoiceRelations(
  userId: number,
  id_Pagante: number,
  id_Paziente: number
): Promise<RelationValidationResult> {
  const payer = await prisma.pagante.findFirst({
    where: { id: id_Pagante, id_Utente: userId, archiviato: false },
  });
  if (!payer) {
    return { error: "Pagante selezionato non valido" };
  }

  const patient = await prisma.paziente.findFirst({
    where: { id: id_Paziente, id_Utente: userId, archiviato: false },
  });
  if (!patient) {
    return { error: "Paziente selezionato non valido" };
  }

  if (patient.id_Pagante !== id_Pagante) {
    return { error: "Il paziente non è associato al pagante selezionato" };
  }

  return { payer, patient };
}

export async function getNextInvoiceNumberForYear(
  year: number,
  excludeId?: number
): Promise<number> {
  const userId = await requireUserId();
  return getNextInvoiceNumberForUserYear(userId, year, excludeId);
}

export async function createInvoice(
  data: InvoiceFormData
): Promise<InvoiceActionState> {
  const userId = await requireUserId();

  const parsed = invoiceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Dati non validi" };
  }

  const {
    id_Pagante,
    id_Paziente,
    data: invoiceDate,
    mod_pag,
    sedute,
    commento,
    n_fattura,
    mesi,
    citta,
    cap,
    bolloCodice,
  } = parsed.data;

  const relationResult = await validateInvoiceRelations(
    userId,
    id_Pagante,
    id_Paziente
  );
  if ("error" in relationResult) {
    return { error: relationResult.error };
  }
  const { payer, patient } = relationResult;

  const year = invoiceDate.getFullYear();
  if (await isInvoiceNumberTaken(userId, n_fattura, year)) {
    return {
      error: `Il numero fattura ${n_fattura} è già stato utilizzato nell'anno ${year}`,
    };
  }

  const { previous, next } = await getChronologyNeighbors(userId, year, n_fattura);
  const chronologyConflict = findChronologyConflict(invoiceDate, previous, next);
  if (chronologyConflict) {
    return { error: formatChronologyConflictMessage(chronologyConflict) };
  }

  if (bolloCodice && (await isBolloCodiceTaken(bolloCodice))) {
    return { error: BOLLO_CODICE_DUPLICATO_ERROR };
  }

  const prezzo_totale = mesi.reduce(
    (somma, m) => somma.add(new Prisma.Decimal(m.prezzo)),
    new Prisma.Decimal(0)
  );

  let createdInvoiceId: number;
  try {
    // Lo snapshot del layout PDF viene incluso direttamente nel create (come
    // snapshotAnagrafica), non più con un update
    // separato best-effort a valle. Così non può esistere una fattura persistita
    // con pdfLayoutSnapshot = null per via di un update fallito silenziosamente:
    // se questa lettura non riesce, l'intero create fallisce e non si crea nulla.
    const pdfLayoutSnapshot = await getPdfSettingsForUser(userId);
    const created = await prisma.pagamento.create({
      data: {
        id_Utente: userId,
        id_Pagante,
        id_Paziente,
        data: invoiceDate,
        anno: year,
        prezzo_totale,
        mod_pag,
        sedute: sedute ?? null,
        commento: commento || null,
        n_fattura,
        citta,
        cap,
        bolloCodice: bolloCodice ?? null,
        snapshotAnagrafica: buildSnapshotAnagrafica(
          payer,
          patient
        ) as unknown as Prisma.InputJsonValue,
        pdfLayoutSnapshot: pdfLayoutSnapshot as unknown as Prisma.InputJsonValue,
        mesi: {
          create: mesi.map(({ mese, prezzo }) => ({ mese, prezzo })),
        },
      },
    });
    createdInvoiceId = created.id;
  } catch (error) {
    if (isBolloCodiceUniqueViolation(error)) {
      return { error: BOLLO_CODICE_DUPLICATO_ERROR };
    }
    if (isInvoiceNumberUniqueViolation(error)) {
      return {
        error: `Il numero fattura ${n_fattura} è già stato utilizzato nell'anno ${year}`,
      };
    }
    return { error: "Errore durante la creazione della fattura" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.INVOICE_CREATE,
    userId,
    entita: "Pagamento",
    entitaId: createdInvoiceId,
    meta: { n_fattura, anno: year },
    ip: await getClientIp(),
  });

  revalidatePath("/invoices");
  return { success: true };
}

export async function updateInvoice(
  id: number,
  data: InvoiceFormData
): Promise<InvoiceActionState> {
  const userId = await requireUserId();

  const parsed = invoiceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Dati non validi" };
  }

  // n_fattura/anno non sono più modificabili dopo la creazione. Servono i
  // valori esistenti per confrontarli con
  // quelli inviati, prima di applicare qualunque altra modifica.
  const existing = await prisma.pagamento.findFirst({
    where: { id, id_Utente: userId },
    select: { n_fattura: true, anno: true, id_Pagante: true, id_Paziente: true },
  });
  if (!existing) {
    return { error: "Fattura non trovata" };
  }

  const {
    id_Pagante,
    id_Paziente,
    data: invoiceDate,
    mod_pag,
    sedute,
    commento,
    n_fattura,
    mesi,
    citta,
    cap,
    bolloCodice,
  } = parsed.data;

  const year = invoiceDate.getFullYear();

  if (n_fattura !== existing.n_fattura) {
    return {
      error: "Non è possibile modificare il numero di una fattura già emessa",
    };
  }
  if (year !== existing.anno) {
    return {
      error: "Non è possibile modificare l'anno di una fattura già emessa",
    };
  }

  const relationResult = await validateInvoiceRelations(
    userId,
    id_Pagante,
    id_Paziente
  );
  if ("error" in relationResult) {
    return { error: relationResult.error };
  }
  const { payer, patient } = relationResult;

  // Lo snapshot va ricatturato SOLO se cambia a chi è intestata la fattura,
  // mai per una modifica non correlata (vedi spec: altrimenti un
  // aggiornamento dell'indirizzo del pagante fatto dopo l'emissione
  // riapparirebbe alla prima modifica successiva, riaprendo il bug che
  // questo fix deve risolvere).
  const anagraficaCambiata =
    id_Pagante !== existing.id_Pagante || id_Paziente !== existing.id_Paziente;

  // Giorno/mese restano liberi, ma non devono invertire l'ordine
  // cronologico rispetto alle fatture con numero adiacente nello stesso
  // anno (vedi lib/invoices/chronology.ts).
  const { previous, next } = await getChronologyNeighbors(
    userId,
    year,
    n_fattura,
    id
  );
  const chronologyConflict = findChronologyConflict(invoiceDate, previous, next);
  if (chronologyConflict) {
    return { error: formatChronologyConflictMessage(chronologyConflict) };
  }

  if (bolloCodice && (await isBolloCodiceTaken(bolloCodice, id))) {
    return { error: BOLLO_CODICE_DUPLICATO_ERROR };
  }

  const prezzo_totale = mesi.reduce(
    (somma, m) => somma.add(new Prisma.Decimal(m.prezzo)),
    new Prisma.Decimal(0)
  );

  try {
    await prisma.pagamento.update({
      where: { id, id_Utente: userId },
      data: {
        id_Pagante,
        id_Paziente,
        data: invoiceDate,
        anno: year,
        prezzo_totale,
        mod_pag,
        sedute: sedute ?? null,
        commento: commento || null,
        n_fattura,
        citta,
        cap,
        bolloCodice: bolloCodice ?? null,
        ...(anagraficaCambiata
          ? {
              snapshotAnagrafica: buildSnapshotAnagrafica(
                payer,
                patient
              ) as unknown as Prisma.InputJsonValue,
            }
          : {}),
        mesi: {
          deleteMany: {},
          create: mesi.map(({ mese, prezzo }) => ({ mese, prezzo })),
        },
      },
    });
  } catch (error) {
    if (isBolloCodiceUniqueViolation(error)) {
      return { error: BOLLO_CODICE_DUPLICATO_ERROR };
    }
    return { error: "Errore durante l'aggiornamento della fattura" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.INVOICE_UPDATE,
    userId,
    entita: "Pagamento",
    entitaId: id,
    meta: { n_fattura, anno: year },
    ip: await getClientIp(),
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}/edit`);
  return { success: true };
}

export async function deleteInvoice(id: number): Promise<InvoiceActionState> {
  const userId = await requireUserId();

  // La riga sparisce fisicamente: i dati identificativi della fattura vengono
  // conservati nel meta dell'evento di audit, unica traccia superstite.
  const invoice = await prisma.pagamento.findFirst({
    where: { id, id_Utente: userId },
    include: { pagante: true, paziente: true },
  });
  if (!invoice) return { error: "Fattura non trovata" };

  try {
    await prisma.pagamento.delete({ where: { id, id_Utente: userId } });
  } catch (error) {
    console.error("deleteInvoice error", error);
    return { error: "Errore durante l'eliminazione della fattura" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.INVOICE_DELETE,
    userId,
    entita: "Pagamento",
    entitaId: id,
    ip: await getClientIp(),
    meta: {
      n_fattura: invoice.n_fattura,
      anno: invoice.anno,
      data: invoice.data.toISOString(),
      prezzo_totale: invoice.prezzo_totale.toString(),
      pagante: `${invoice.pagante.cognome} ${invoice.pagante.nome}`,
      paziente: `${invoice.paziente.cognome} ${invoice.paziente.nome}`,
    },
  });

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function refreshInvoiceAnagrafica(
  id: number
): Promise<InvoiceActionState> {
  const userId = await requireUserId();

  const invoice = await prisma.pagamento.findFirst({
    where: { id, id_Utente: userId },
    include: { pagante: true, paziente: true },
  });
  if (!invoice) {
    return { error: "Fattura non trovata" };
  }

  try {
    // Legge intenzionalmente le relazioni live (non resolveAnagrafica):
    // questa azione esiste apposta per sostituire lo snapshot congelato
    // con lo stato attuale, su scelta esplicita dell'utente.
    await prisma.pagamento.update({
      where: { id, id_Utente: userId },
      data: {
        snapshotAnagrafica: buildSnapshotAnagrafica(
          invoice.pagante,
          invoice.paziente
        ) as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("refreshInvoiceAnagrafica error", error);
    return { error: "Errore durante l'aggiornamento dell'anagrafica" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.INVOICE_ANAGRAFICA_REFRESH,
    userId,
    entita: "Pagamento",
    entitaId: id,
    ip: await getClientIp(),
  });

  revalidatePath("/invoices");
  return { success: true };
}
