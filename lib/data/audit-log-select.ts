import type { Prisma } from "@prisma/client";

// Whitelist esplicita, stesso pattern di lib/data/user-select.ts. AuditLog
// non ha campi sensibili quanto passwordHash, ma il select esplicito resta
// utile per non trascinare in futuro nuovi campi nel payload RSC senza una
// scelta consapevole, e per includere lo username dell'attore senza una
// query separata.
export const AUDIT_LOG_SELECT = {
  id: true,
  azione: true,
  entita: true,
  entitaId: true,
  meta: true,
  ip: true,
  createdAt: true,
  utente: { select: { id: true, username: true } },
} satisfies Prisma.AuditLogSelect;

export type AuditLogEntry = Prisma.AuditLogGetPayload<{
  select: typeof AUDIT_LOG_SELECT;
}>;
