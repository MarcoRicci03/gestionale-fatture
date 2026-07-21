"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/client-ip";
import { snapshotPdfLayoutForInvoice } from "@/lib/pdf/invoices";
import { invoiceSchema, type InvoiceFormData } from "@/lib/validations/invoice";
import { isUniqueViolationOnField } from "@/lib/prisma-errors";
import { getNextInvoiceNumberForUserYear } from "@/lib/data/invoices";
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

async function validateInvoiceRelations(
  userId: number,
  id_Pagante: number,
  id_Paziente: number
): Promise<string | null> {
  const payer = await prisma.pagante.findFirst({
    where: { id: id_Pagante, id_Utente: userId, eliminato: false },
  });
  if (!payer) {
    return "Pagante selezionato non valido";
  }

  const patient = await prisma.paziente.findFirst({
    where: { id: id_Paziente, id_Utente: userId, eliminato: false },
  });
  if (!patient) {
    return "Paziente selezionato non valido";
  }

  if (patient.id_Pagante !== id_Pagante) {
    return "Il paziente non è associato al pagante selezionato";
  }

  return null;
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

  const relationError = await validateInvoiceRelations(
    userId,
    id_Pagante,
    id_Paziente
  );
  if (relationError) {
    return { error: relationError };
  }

  const year = invoiceDate.getFullYear();
  if (await isInvoiceNumberTaken(userId, n_fattura, year)) {
    return {
      error: `Il numero fattura ${n_fattura} è già stato utilizzato nell'anno ${year}`,
    };
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

  try {
    await snapshotPdfLayoutForInvoice(createdInvoiceId, userId);
  } catch (error) {
    // Non-fatale: la fattura è creata comunque. generateInvoicePdf ha un
    // fallback di sola lettura per il caso in cui lo snapshot resti null.
    console.error("snapshotPdfLayoutForInvoice error", error);
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

  const relationError = await validateInvoiceRelations(
    userId,
    id_Pagante,
    id_Paziente
  );
  if (relationError) {
    return { error: relationError };
  }

  const year = invoiceDate.getFullYear();
  if (await isInvoiceNumberTaken(userId, n_fattura, year, id)) {
    return {
      error: `Il numero fattura ${n_fattura} è già stato utilizzato nell'anno ${year}`,
    };
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
    if (isInvoiceNumberUniqueViolation(error)) {
      return {
        error: `Il numero fattura ${n_fattura} è già stato utilizzato nell'anno ${year}`,
      };
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

  try {
    await prisma.pagamento.delete({ where: { id, id_Utente: userId } });
  } catch {
    return { error: "Errore durante l'eliminazione della fattura" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.INVOICE_DELETE,
    userId,
    entita: "Pagamento",
    entitaId: id,
    ip: await getClientIp(),
  });

  revalidatePath("/invoices");
  return { success: true };
}
