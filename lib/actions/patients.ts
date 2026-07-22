"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/client-ip";
import { patientSchema, type PatientFormData } from "@/lib/validations/patient";
import { logAudit } from "@/lib/audit/log";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { canHardDeletePatient } from "@/lib/archive/guards";

export type PatientActionState = { success: true } | { error: string };

function revalidatePatientViews() {
  revalidatePath("/patients");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

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
        archiviato: false,
      },
    });
    if (!payer) {
      return { error: "Pagante selezionato non valido" };
    }
  }

  let createdPatientId: number;
  try {
    const created = await prisma.paziente.create({
      data: {
        id_Utente: userId,
        nome: parsed.data.nome,
        cognome: parsed.data.cognome,
        id_Pagante: parsed.data.id_Pagante ?? null,
      },
    });
    createdPatientId = created.id;
  } catch (error) {
    console.error("createPatient error", error);
    return { error: "Errore durante la creazione del paziente" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.PATIENT_CREATE,
    userId,
    entita: "Paziente",
    entitaId: createdPatientId,
    ip: await getClientIp(),
  });

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
        archiviato: false,
      },
    });
    if (!payer) {
      return { error: "Pagante selezionato non valido" };
    }
  }

  try {
    await prisma.paziente.update({
      where: { id, id_Utente: userId, archiviato: false },
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

  await logAudit({
    azione: AUDIT_ACTIONS.PATIENT_UPDATE,
    userId,
    entita: "Paziente",
    entitaId: id,
    ip: await getClientIp(),
  });

  revalidatePath("/patients");
  revalidatePath(`/patients/${id}/edit`);
  return { success: true };
}

export async function archivePatient(id: number): Promise<PatientActionState> {
  const userId = await requireUserId();

  try {
    await prisma.paziente.update({
      where: { id, id_Utente: userId },
      data: { archiviato: true },
    });
  } catch (error) {
    console.error("archivePatient error", error);
    return { error: "Errore durante l'archiviazione del paziente" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.PATIENT_ARCHIVE,
    userId,
    entita: "Paziente",
    entitaId: id,
    ip: await getClientIp(),
  });

  revalidatePatientViews();
  return { success: true };
}

export async function restorePatient(id: number): Promise<PatientActionState> {
  const userId = await requireUserId();

  try {
    const updated = await prisma.paziente.updateMany({
      where: { id, id_Utente: userId, archiviato: true },
      data: { archiviato: false },
    });
    if (updated.count === 0) {
      return { error: "Paziente non trovato tra gli archiviati" };
    }
  } catch (error) {
    console.error("restorePatient error", error);
    return { error: "Errore durante il ripristino del paziente" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.PATIENT_RESTORE,
    userId,
    entita: "Paziente",
    entitaId: id,
    ip: await getClientIp(),
  });

  revalidatePatientViews();
  return { success: true };
}

export async function hardDeletePatient(
  id: number
): Promise<PatientActionState> {
  const userId = await requireUserId();

  const patient = await prisma.paziente.findFirst({
    where: { id, id_Utente: userId, archiviato: true },
  });
  if (!patient) {
    return { error: "Paziente non trovato tra gli archiviati" };
  }

  const fatture = await prisma.pagamento.count({
    where: { id_Utente: userId, id_Paziente: id },
  });

  if (!canHardDeletePatient({ fatture })) {
    return {
      error: `Impossibile eliminare: ci sono ${fatture} fattura/e collegata/e. Le fatture non possono essere cancellate.`,
    };
  }

  try {
    await prisma.paziente.delete({ where: { id, id_Utente: userId } });
  } catch (error) {
    console.error("hardDeletePatient error", error);
    return { error: "Errore durante l'eliminazione definitiva del paziente" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.PATIENT_DELETE,
    userId,
    entita: "Paziente",
    entitaId: id,
    meta: {
      nome: patient.nome,
      cognome: patient.cognome,
      id_Pagante: patient.id_Pagante,
    },
    ip: await getClientIp(),
  });

  revalidatePatientViews();
  return { success: true };
}
