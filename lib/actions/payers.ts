"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/client-ip";
import { isUniqueViolationOnField } from "@/lib/prisma-errors";
import { payerSchema, type PayerFormData } from "@/lib/validations/payer";
import { logAudit } from "@/lib/audit/log";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { canHardDeletePayer, findRestoreConflict } from "@/lib/archive/guards";

export type PayerActionState = { success: true } | { error: string };

function revalidatePayerViews() {
  revalidatePath("/payers");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/patients");
}

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
      archiviato: false,
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

  let createdPayerId: number;
  try {
    const created = await prisma.pagante.create({
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
    createdPayerId = created.id;
  } catch (error) {
    if (isUniqueViolationOnField(error, "cf")) {
      return { error: "Codice Fiscale già presente" };
    }
    if (isUniqueViolationOnField(error, "piva")) {
      return { error: "Partita IVA già presente" };
    }
    console.error("createPayer error", error);
    return { error: "Errore durante la creazione del pagante" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.PAYER_CREATE,
    userId,
    entita: "Pagante",
    entitaId: createdPayerId,
    ip: await getClientIp(),
  });

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
      where: { id, id_Utente: userId, archiviato: false },
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
  } catch (error) {
    if (isUniqueViolationOnField(error, "cf")) {
      return { error: "Codice Fiscale già presente" };
    }
    if (isUniqueViolationOnField(error, "piva")) {
      return { error: "Partita IVA già presente" };
    }
    console.error("updatePayer error", error);
    return { error: "Errore durante l'aggiornamento del pagante" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.PAYER_UPDATE,
    userId,
    entita: "Pagante",
    entitaId: id,
    ip: await getClientIp(),
  });

  revalidatePath("/payers");
  revalidatePath(`/payers/${id}/edit`);
  return { success: true };
}

export async function archivePayer(id: number): Promise<PayerActionState> {
  const userId = await requireUserId();

  let pazientiArchiviati = 0;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.pagante.update({
        where: { id, id_Utente: userId },
        data: { archiviato: true },
      });
      // I pazienti di un pagante archiviato non devono restare negli elenchi
      // operativi né nelle tendine: seguono il pagante. archiviatoInCascata
      // distingue questa archiviazione (a cascata) da una manuale
      // (archivePatient in lib/actions/patients.ts) — serve a restorePayer
      // per non riattivare pazienti che l'utente aveva archiviato per conto
      // suo prima (LOG-09).
      const result = await tx.paziente.updateMany({
        where: { id_Utente: userId, id_Pagante: id, archiviato: false },
        data: { archiviato: true, archiviatoInCascata: true },
      });
      pazientiArchiviati = result.count;
    });
  } catch (error) {
    console.error("archivePayer error", error);
    return { error: "Errore durante l'archiviazione del pagante" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.PAYER_ARCHIVE,
    userId,
    entita: "Pagante",
    entitaId: id,
    meta: { pazientiArchiviatiInCascata: pazientiArchiviati },
    ip: await getClientIp(),
  });

  revalidatePayerViews();
  return { success: true };
}

export async function restorePayer(id: number): Promise<PayerActionState> {
  const userId = await requireUserId();

  const payer = await prisma.pagante.findFirst({
    where: { id, id_Utente: userId, archiviato: true },
  });
  if (!payer) {
    return { error: "Pagante non trovato tra gli archiviati" };
  }

  const activePayers = await prisma.pagante.findMany({
    where: { id_Utente: userId, archiviato: false },
    select: { id: true, cf: true, piva: true, nome: true, cognome: true },
  });
  const conflict = findRestoreConflict(
    { cf: payer.cf, piva: payer.piva },
    activePayers
  );
  if (conflict) {
    const conflictingPayer = activePayers.find(
      (p) => p.id === conflict.conflictingId
    );
    const fieldLabel = conflict.field === "cf" ? "codice fiscale" : "partita IVA";
    const name = conflictingPayer
      ? `${conflictingPayer.nome} ${conflictingPayer.cognome}`
      : `#${conflict.conflictingId}`;
    return {
      error: `Impossibile ripristinare: esiste già un pagante attivo con lo stesso ${fieldLabel} (${name}). Modifica o archivia quel pagante prima di ripristinare.`,
    };
  }

  let pazientiRipristinati = 0;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.pagante.update({
        where: { id, id_Utente: userId },
        data: { archiviato: false },
      });
      // Ripristina SOLO i pazienti archiviati dalla cascata di archivePayer
      // (archiviatoInCascata: true), non quelli che l'utente aveva
      // archiviato singolarmente prima (LOG-09): senza questo filtro, un
      // paziente archiviato deliberatamente in precedenza ricomparirebbe tra
      // gli attivi come effetto collaterale a sorpresa del ripristino del
      // pagante. archiviatoInCascata viene azzerato sui pazienti ripristinati
      // qui, per non lasciare una cascata passata a "ricordarsi" su una
      // futura archiviazione manuale dello stesso paziente.
      const result = await tx.paziente.updateMany({
        where: {
          id_Utente: userId,
          id_Pagante: id,
          archiviato: true,
          archiviatoInCascata: true,
        },
        data: { archiviato: false, archiviatoInCascata: false },
      });
      pazientiRipristinati = result.count;
    });
  } catch (error) {
    if (isUniqueViolationOnField(error, "cf")) {
      return { error: "Codice Fiscale già presente su un pagante attivo" };
    }
    if (isUniqueViolationOnField(error, "piva")) {
      return { error: "Partita IVA già presente su un pagante attivo" };
    }
    console.error("restorePayer error", error);
    return { error: "Errore durante il ripristino del pagante" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.PAYER_RESTORE,
    userId,
    entita: "Pagante",
    entitaId: id,
    meta: { pazientiRipristinatiInCascata: pazientiRipristinati },
    ip: await getClientIp(),
  });

  revalidatePayerViews();
  return { success: true };
}

export async function hardDeletePayer(id: number): Promise<PayerActionState> {
  const userId = await requireUserId();

  const payer = await prisma.pagante.findFirst({
    where: { id, id_Utente: userId, archiviato: true },
  });
  if (!payer) {
    return { error: "Pagante non trovato tra gli archiviati" };
  }

  const [fatture, pazientiNonArchiviati, pazientiArchiviatiCollegati] =
    await Promise.all([
      prisma.pagamento.count({
        where: {
          id_Utente: userId,
          OR: [{ id_Pagante: id }, { paziente: { id_Pagante: id } }],
        },
      }),
      prisma.paziente.count({
        where: { id_Utente: userId, id_Pagante: id, archiviato: false },
      }),
      prisma.paziente.findMany({
        where: { id_Utente: userId, id_Pagante: id, archiviato: true },
        select: { id: true, nome: true, cognome: true },
      }),
    ]);

  if (!canHardDeletePayer({ fatture, pazientiNonArchiviati })) {
    if (fatture > 0) {
      return {
        error: `Impossibile eliminare: ci sono ${fatture} fattura/e collegata/e. Le fatture non possono essere cancellate.`,
      };
    }
    return {
      error: `Impossibile eliminare: ${pazientiNonArchiviati} paziente/i collegato/i non è/sono ancora archiviato/i. Archivia prima quei pazienti.`,
    };
  }

  try {
    // Il cascade DB su pazienti.id_Pagante colpisce solo pazienti già
    // archiviati e senza fatture (garantito dai conteggi sopra), mai un
    // record che l'utente non ha esplicitamente archiviato.
    await prisma.pagante.delete({ where: { id, id_Utente: userId } });
  } catch (error) {
    console.error("hardDeletePayer error", error);
    return { error: "Errore durante l'eliminazione definitiva del pagante" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.PAYER_DELETE,
    userId,
    entita: "Pagante",
    entitaId: id,
    meta: {
      nome: payer.nome,
      cognome: payer.cognome,
      cf: payer.cf,
      piva: payer.piva,
      pazientiEliminatiInCascata: pazientiArchiviatiCollegati,
    },
    ip: await getClientIp(),
  });

  revalidatePayerViews();
  return { success: true };
}
