"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { invoiceSchema, type InvoiceFormData } from "@/lib/validations/invoice";

export type InvoiceActionState = { success: true } | { error: string };

function yearRange(year: number) {
  return {
    gte: new Date(year, 0, 1),
    lt: new Date(year + 1, 0, 1),
  };
}

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
      data: yearRange(year),
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
  const last = await prisma.pagamento.findFirst({
    where: {
      id_Utente: userId,
      data: yearRange(year),
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    orderBy: { n_fattura: "desc" },
  });
  return (last?.n_fattura ?? 0) + 1;
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

  const prezzo_totale = mesi.reduce((somma, m) => somma + m.prezzo, 0);

  try {
    await prisma.pagamento.create({
      data: {
        id_Utente: userId,
        id_Pagante,
        id_Paziente,
        data: invoiceDate,
        prezzo_totale,
        mod_pag,
        sedute: sedute ?? null,
        commento: commento || null,
        n_fattura,
        citta,
        cap,
        mesi: {
          create: mesi.map(({ mese, prezzo }) => ({ mese, prezzo })),
        },
      },
    });
  } catch {
    return { error: "Errore durante la creazione della fattura" };
  }

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

  const prezzo_totale = mesi.reduce((somma, m) => somma + m.prezzo, 0);

  try {
    await prisma.pagamento.update({
      where: { id, id_Utente: userId },
      data: {
        id_Pagante,
        id_Paziente,
        data: invoiceDate,
        prezzo_totale,
        mod_pag,
        sedute: sedute ?? null,
        commento: commento || null,
        n_fattura,
        citta,
        cap,
        mesi: {
          deleteMany: {},
          create: mesi.map(({ mese, prezzo }) => ({ mese, prezzo })),
        },
      },
    });
  } catch {
    return { error: "Errore durante l'aggiornamento della fattura" };
  }

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

  revalidatePath("/invoices");
  return { success: true };
}
