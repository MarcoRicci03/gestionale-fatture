"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { payerSchema, type PayerFormData } from "@/lib/validations/payer";

export type PayerActionState = { success: true } | { error: string };

async function checkPayerUniqueTaxIds(
  userId: number,
  cf: string | null | undefined,
  piva: string | null | undefined,
  excludeId?: number
): Promise<string | null> {
  if (!cf && !piva) return null;

  const conditions: Array<{ cf: string } | { piva: string }> = [];
  if (cf) conditions.push({ cf });
  if (piva) conditions.push({ piva });

  const existing = await prisma.pagante.findFirst({
    where: {
      id_Utente: userId,
      eliminato: false,
      id: excludeId ? { not: excludeId } : undefined,
      OR: conditions,
    },
  });

  if (!existing) return null;
  if (cf && existing.cf === cf) return "Codice Fiscale già presente";
  if (piva && existing.piva === piva) return "Partita IVA già presente";
  return null;
}

export async function createPayer(
  data: PayerFormData
): Promise<PayerActionState> {
  const userId = await requireUserId();

  const parsed = payerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Dati non validi" };
  }

  const duplicateError = await checkPayerUniqueTaxIds(
    userId,
    parsed.data.cf,
    parsed.data.piva
  );
  if (duplicateError) {
    return { error: duplicateError };
  }

  try {
    await prisma.pagante.create({
      data: {
        id_Utente: userId,
        nome: parsed.data.nome,
        cognome: parsed.data.cognome,
        via: parsed.data.via,
        citta: parsed.data.citta,
        cap: parsed.data.cap,
        cf: parsed.data.cf ?? null,
        piva: parsed.data.piva ?? null,
      },
    });
  } catch {
    return { error: "Errore durante la creazione del pagante" };
  }

  revalidatePath("/payers");
  return { success: true };
}

export async function updatePayer(
  id: number,
  data: PayerFormData
): Promise<PayerActionState> {
  const userId = await requireUserId();

  const parsed = payerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Dati non validi" };
  }

  const duplicateError = await checkPayerUniqueTaxIds(
    userId,
    parsed.data.cf,
    parsed.data.piva,
    id
  );
  if (duplicateError) {
    return { error: duplicateError };
  }

  try {
    await prisma.pagante.update({
      where: { id, id_Utente: userId, eliminato: false },
      data: {
        nome: parsed.data.nome,
        cognome: parsed.data.cognome,
        via: parsed.data.via,
        citta: parsed.data.citta,
        cap: parsed.data.cap,
        cf: parsed.data.cf ?? null,
        piva: parsed.data.piva ?? null,
      },
    });
  } catch {
    return { error: "Errore durante l'aggiornamento del pagante" };
  }

  revalidatePath("/payers");
  revalidatePath(`/payers/${id}/edit`);
  return { success: true };
}

export async function deletePayer(id: number): Promise<PayerActionState> {
  const userId = await requireUserId();

  try {
    await prisma.pagante.update({
      where: { id, id_Utente: userId },
      data: { eliminato: true },
    });
  } catch {
    return { error: "Errore durante l'eliminazione del pagante" };
  }

  revalidatePath("/payers");
  return { success: true };
}
