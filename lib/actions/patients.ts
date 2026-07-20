"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { patientSchema, type PatientFormData } from "@/lib/validations/patient";

export type PatientActionState = { success: true } | { error: string };

export async function createPatient(
  data: PatientFormData
): Promise<PatientActionState> {
  const userId = await requireUserId();

  const parsed = patientSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Dati non validi" };
  }

  if (parsed.data.id_Pagante) {
    const payer = await prisma.pagante.findFirst({
      where: {
        id: parsed.data.id_Pagante,
        id_Utente: userId,
        eliminato: false,
      },
    });
    if (!payer) {
      return { error: "Pagante selezionato non valido" };
    }
  }

  try {
    await prisma.paziente.create({
      data: {
        id_Utente: userId,
        nome: parsed.data.nome,
        cognome: parsed.data.cognome,
        id_Pagante: parsed.data.id_Pagante ?? null,
      },
    });
  } catch (error) {
    console.error("createPatient error", error);
    return { error: "Errore durante la creazione del paziente" };
  }

  revalidatePath("/patients");
  return { success: true };
}

export async function updatePatient(
  id: number,
  data: PatientFormData
): Promise<PatientActionState> {
  const userId = await requireUserId();

  const parsed = patientSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Dati non validi" };
  }

  if (parsed.data.id_Pagante) {
    const payer = await prisma.pagante.findFirst({
      where: {
        id: parsed.data.id_Pagante,
        id_Utente: userId,
        eliminato: false,
      },
    });
    if (!payer) {
      return { error: "Pagante selezionato non valido" };
    }
  }

  try {
    await prisma.paziente.update({
      where: { id, id_Utente: userId, eliminato: false },
      data: {
        nome: parsed.data.nome,
        cognome: parsed.data.cognome,
        id_Pagante: parsed.data.id_Pagante ?? null,
      },
    });
  } catch (error) {
    console.error("updatePatient error", error);
    return { error: "Errore durante l'aggiornamento del paziente" };
  }

  revalidatePath("/patients");
  revalidatePath(`/patients/${id}/edit`);
  return { success: true };
}

export async function deletePatient(id: number): Promise<PatientActionState> {
  const userId = await requireUserId();

  try {
    await prisma.paziente.update({
      where: { id, id_Utente: userId },
      data: { eliminato: true },
    });
  } catch (error) {
    console.error("deletePatient error", error);
    return { error: "Errore durante l'eliminazione del paziente" };
  }

  revalidatePath("/patients");
  return { success: true };
}
