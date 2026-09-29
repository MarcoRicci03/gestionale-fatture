"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/client-ip";
import { patientSchema, type PatientFormData } from "@/lib/validations/patient";
import { logAudit } from "@/lib/audit/log";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { canHardDeletePatient } from "@/lib/archive/guards";
import { isForeignKeyViolation } from "@/lib/prisma-errors";
import type { ActionResult } from "@/lib/types/actions";
import { isValidId } from "@/lib/validations/id";

export type PatientActionState = ActionResult;

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
    return { success: false, error: "Dati non validi" };
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
      return { success: false, error: "Pagante selezionato non valido" };
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
    return { success: false, error: "Errore durante la creazione del paziente" };
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

  if (!isValidId(id)) {
    return { success: false, error: "Richiesta non valida" };
  }

  const parsed = patientSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dati non validi" };
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
      return { success: false, error: "Pagante selezionato non valido" };
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
    return { success: false, error: "Errore durante l'aggiornamento del paziente" };
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

  if (!isValidId(id)) {
    return { success: false, error: "Richiesta non valida" };
  }

  try {
    // archiviatoInCascata: false esplicito (non solo il default): questa è
    // un'archiviazione manuale del singolo paziente, mai una cascata da
    // archivePayer (LOG-09) — necessario anche per il caso in cui il
    // paziente avesse ancora true da una cascata passata seguita da un
    // ripristino non passato da restorePayer.
    const updated = await prisma.paziente.updateMany({
      where: { id, id_Utente: userId, archiviato: false },
      data: { archiviato: true, archiviatoInCascata: false },
    });
    if (updated.count === 0) {
      return { success: false, error: "Paziente non trovato tra gli attivi" };
    }
  } catch (error) {
    console.error("archivePatient error", error);
    return { success: false, error: "Errore durante l'archiviazione del paziente" };
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

  if (!isValidId(id)) {
    return { success: false, error: "Richiesta non valida" };
  }

  try {
    // archiviatoInCascata: false esplicito (LOG-09): ripristino manuale del
    // singolo paziente, indipendente da restorePayer — azzera comunque il
    // flag per non lasciare una cascata passata a "ricordarsi" sul prossimo
    // ciclo di archiviazione/ripristino.
    const updated = await prisma.paziente.updateMany({
      where: { id, id_Utente: userId, archiviato: true },
      data: { archiviato: false, archiviatoInCascata: false },
    });
    if (updated.count === 0) {
      return { success: false, error: "Paziente non trovato tra gli archiviati" };
    }
  } catch (error) {
    console.error("restorePatient error", error);
    return { success: false, error: "Errore durante il ripristino del paziente" };
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

  if (!isValidId(id)) {
    return { success: false, error: "Richiesta non valida" };
  }

  let idPagante: number | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const patient = await tx.paziente.findFirst({
        where: { id, id_Utente: userId, archiviato: true },
      });
      if (!patient) {
        throw new Error("Paziente non trovato tra gli archiviati");
      }

      const fatture = await tx.pagamento.count({
        where: { id_Utente: userId, id_Paziente: id },
      });

      if (!canHardDeletePatient({ fatture })) {
        throw new Error(
          `Impossibile eliminare: ci sono ${fatture} fattura/e collegata/e. Le fatture non possono essere cancellate.`
        );
      }

      idPagante = patient.id_Pagante;
      await tx.paziente.delete({ where: { id, id_Utente: userId } });
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return {
        success: false,
        error:
          "Impossibile eliminare: sono presenti record (fatture) collegati a questo paziente",
      };
    }
    if (error instanceof Error) {
      if (
        error.message === "Paziente non trovato tra gli archiviati" ||
        error.message.startsWith("Impossibile eliminare:")
      ) {
        return { success: false, error: error.message };
      }
    }
    console.error("hardDeletePatient error", error);
    return { success: false, error: "Errore durante l'eliminazione definitiva del paziente" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.PATIENT_DELETE,
    userId,
    entita: "Paziente",
    entitaId: id,
    meta: {
      id_Pagante: idPagante,
    },
    ip: await getClientIp(),
  });

  revalidatePatientViews();
  return { success: true };
}
