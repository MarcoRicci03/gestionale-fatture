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

// Scrive una riga di audit log. Best-effort e deliberatamente non bloccante:
// un fallimento nella scrittura non deve mai
// far fallire un'operazione già eseguita con successo (la mutazione è già
// committata su Postgres quando questa funzione viene chiamata). Va sempre
// `await`-ata dal chiamante, mai lanciata come "fire and forget": in una
// Server Action una promise non legata al ciclo di vita della risposta
// rischia di essere interrotta prima di completarsi in ambienti
// serverless/edge.
//
// Non passare MAI in `meta` password (nemmeno tentate), passwordHash o token
// di sessione: solo identificatori e valori già non sensibili.
//
// Non passare MAI in `meta` dati anagrafici identificanti di pazienti/paganti
// (nome, cognome, codice fiscale, partita IVA, indirizzo): getAuditLog() non
// applica scoping per id_Utente (un admin deve vedere gli eventi di tutti gli
// utenti), quindi in un deployment multi-studio un admin che non è titolare
// del trattamento sui pazienti di un altro logopedista li leggerebbe comunque
// da qui (SEC-04). entitaId identifica già la riga; per le hard-delete, dove
// la riga sparisce fisicamente, usa solo riferimenti non identificanti (id
// numerici, conteggi) — mai stringhe con nome/cognome.
// scripts/verify-audit-log-no-pii.test.ts verifica questa invariante.
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await logAuditOrThrow(params);
  } catch (error) {
    // Prefisso grep-abile (LOG-06): l'unica traccia di uno scarto qui è
    // stderr del container, con vita finita (max-size/max-file nel logging
    // driver di docker-compose.prod.yml) — questo prefisso è il gancio
    // previsto per un futuro allarme di monitoraggio (DEP-06).
    console.error("AUDIT_WRITE_FAILED", params.azione, error);
  }
}

// Variante che propaga l'errore invece di inghiottirlo: da usare SOLO dentro
// una transazione interattiva già aperta per un'altra mutazione, quando
// l'evento di audit è l'unica traccia superstite di quella mutazione (LOG-06,
// es. deleteInvoice — la fattura sparisce fisicamente e il `meta` è l'unica
// copia dei suoi dati). In quel caso specifico un fallimento della scrittura
// deve far fallire (ed eseguire il rollback de) l'intera transazione,
// altrimenti si perderebbero sia la riga che la sua unica traccia. Non usare
// fuori da una transazione: per le mutazioni non transazionali resta valido
// il ragionamento di `logAudit` sopra (la mutazione è già committata, non
// farla fallire a valle).
export async function logAuditOrThrow(
  params: LogAuditParams,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  await client.auditLog.create({
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
}
