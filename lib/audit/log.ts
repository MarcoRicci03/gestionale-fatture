import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { AuditAction } from "./actions";

type LogAuditParams = {
  userId: number | null;
  azione: AuditAction;
  entita?: string;
  entitaId?: number;
  meta?: Record<string, unknown>;
  ip?: string;
};

// Scrive una riga di audit log (SEC-15 in SECURITY_AUDIT.md). Best-effort e
// deliberatamente non bloccante: un fallimento nella scrittura non deve mai
// far fallire un'operazione già eseguita con successo (la mutazione è già
// committata su Postgres quando questa funzione viene chiamata). Va sempre
// `await`-ata dal chiamante, mai lanciata come "fire and forget": in una
// Server Action una promise non legata al ciclo di vita della risposta
// rischia di essere interrotta prima di completarsi in ambienti
// serverless/edge.
//
// Non passare MAI in `meta` password (nemmeno tentate), passwordHash o token
// di sessione: solo identificatori e valori già non sensibili.
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        id_Utente: params.userId,
        azione: params.azione,
        entita: params.entita ?? null,
        entitaId: params.entitaId ?? null,
        meta: params.meta
          ? (params.meta as unknown as Prisma.InputJsonValue)
          : undefined,
        ip: params.ip ?? null,
      },
    });
  } catch (error) {
    console.error("logAudit error", params.azione, error);
  }
}
