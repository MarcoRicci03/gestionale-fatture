import type { Prisma } from "@prisma/client";

export type AuditLogFilters = {
  dataDa: string;
  dataA: string;
  utente: string;
  azione: string;
  ricerca: string;
};

export const EMPTY_AUDIT_LOG_FILTERS: AuditLogFilters = {
  dataDa: "",
  dataA: "",
  utente: "",
  azione: "",
  ricerca: "",
};

// Confronto su timestamp (createdAt include l'orario), non su date-only come
// invoice.data: dataDa/dataA vanno espansi ai bordi della giornata per non
// escludere a torto gli eventi della prima/ultima ora. Non si riusa
// parseDateInput (lib/utils/date.ts), che normalizza a mezzogiorno per un
// caso d'uso diverso (confronto tra due date-only).
function startOfDay(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function endOfDay(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

// LOG-03: where Prisma invece di un filtro su array già troncato a 200 righe
// (getAuditLog, lib/data/audit-log.ts) — stessa forma di buildInvoiceWhere/
// buildPatientWhere. Non applica scoping per id_Utente: un admin deve vedere
// gli eventi di tutti gli utenti (getAuditLog lo garantisce già, non qui).
//
// `ricerca` cerca in entita/ip con `contains` (come prima), ma su entitaId
// fa un match ESATTO se `ricerca` è un intero valido — non più un substring
// sulla stringificazione dell'id (cercare "4" prima poteva incidentalmente
// matchare l'id 42): non è esprimibile in un `where` Prisma portabile senza
// SQL raw, e non vale la complessità per un campo di ricerca libera.
export function buildAuditLogWhere(
  filters: AuditLogFilters
): Prisma.AuditLogWhereInput {
  const conditions: Prisma.AuditLogWhereInput[] = [];

  if (filters.dataDa || filters.dataA) {
    conditions.push({
      createdAt: {
        ...(filters.dataDa ? { gte: startOfDay(filters.dataDa) } : {}),
        ...(filters.dataA ? { lte: endOfDay(filters.dataA) } : {}),
      },
    });
  }
  if (filters.utente) {
    conditions.push({ utente: { is: { username: filters.utente } } });
  }
  if (filters.azione) {
    conditions.push({ azione: filters.azione });
  }
  const ricerca = filters.ricerca.trim();
  if (ricerca) {
    const asNumber = Number(ricerca);
    const isNumeric = Number.isInteger(asNumber);
    conditions.push({
      OR: [
        { entita: { contains: ricerca, mode: "insensitive" as const } },
        { ip: { contains: ricerca, mode: "insensitive" as const } },
        ...(isNumeric ? [{ entitaId: asNumber }] : []),
      ],
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}
