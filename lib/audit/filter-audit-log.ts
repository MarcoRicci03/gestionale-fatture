import type { AuditLogEntry } from "@/lib/data/audit-log-select";

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

export function filterAuditLogEntries(
  entries: AuditLogEntry[],
  filters: AuditLogFilters
): AuditLogEntry[] {
  const dataDa = filters.dataDa ? startOfDay(filters.dataDa) : null;
  const dataA = filters.dataA ? endOfDay(filters.dataA) : null;
  const ricerca = filters.ricerca.trim().toLowerCase();

  return entries.filter((entry) => {
    if (dataDa && entry.createdAt < dataDa) return false;
    if (dataA && entry.createdAt > dataA) return false;
    if (filters.utente && entry.utente?.username !== filters.utente) return false;
    if (filters.azione && entry.azione !== filters.azione) return false;
    if (ricerca) {
      const haystack = [
        entry.entita ?? "",
        entry.entitaId != null ? String(entry.entitaId) : "",
        entry.ip ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(ricerca)) return false;
    }
    return true;
  });
}

export function getDistinctUsernames(entries: AuditLogEntry[]): string[] {
  const usernames = entries
    .map((entry) => entry.utente?.username)
    .filter((username): username is string => Boolean(username));
  return Array.from(new Set(usernames)).sort((a, b) => a.localeCompare(b, "it"));
}
