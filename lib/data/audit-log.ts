import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { AUDIT_LOG_SELECT, type AuditLogEntry } from "./audit-log-select";
import { buildAuditLogWhere, type AuditLogFilters } from "@/lib/audit/list-query";
import { lastValidPage } from "@/lib/utils/pagination";
import { AUDIT_LOG_PAGE_SIZE } from "@/lib/constants/audit-log";
import type { Prisma } from "@prisma/client";

// LOG-03: paginato e filtrato lato server, stessa forma di getInvoices/
// getPatients — non applica scoping per id_Utente, scelta deliberata e
// documentata: un admin deve vedere gli eventi di tutti gli utenti, non solo
// i propri (requireAdmin() lo garantisce già).
function findAuditLogPage(
  where: Prisma.AuditLogWhereInput,
  page: number
): Promise<AuditLogEntry[]> {
  return prisma.auditLog.findMany({
    where,
    select: AUDIT_LOG_SELECT,
    // `id` come tiebreaker: createdAt non è univoco (più eventi nello stesso
    // istante), stesso motivo di `id` in findInvoicesPage.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * AUDIT_LOG_PAGE_SIZE,
    take: AUDIT_LOG_PAGE_SIZE,
  });
}

export async function getAuditLog(
  filters: AuditLogFilters,
  page: number
): Promise<{ entries: AuditLogEntry[]; totalCount: number; page: number }> {
  await requireAdmin();
  const where = buildAuditLogWhere(filters);
  const [entries, totalCount] = await Promise.all([
    findAuditLogPage(where, page),
    prisma.auditLog.count({ where }),
  ]);

  // Stesso clamp di getInvoices/getPatients: `page` oltre l'ultima
  // disponibile per questo filtro (utente sull'ultima pagina svuotata da una
  // retention nel frattempo, o URL manomesso) rifà la query una sola volta
  // sulla pagina valida più vicina, invece di mostrare "nessun evento" pur
  // essendocene.
  const clampedPage = Math.min(page, lastValidPage(totalCount, AUDIT_LOG_PAGE_SIZE));
  const effectiveEntries =
    clampedPage === page ? entries : await findAuditLogPage(where, clampedPage);

  return { entries: effectiveEntries, totalCount, page: clampedPage };
}

// Alimenta la tendina "Utente" del filtro (components/audit-log/audit-log-filter-bar.tsx):
// tutti gli utenti esistenti, non solo quelli comparsi nella pagina corrente
// di eventi (con la paginazione server, un derive dagli `entries` mostrerebbe
// solo gli username della pagina visibile). Select minimale dedicato, non
// SAFE_USER_SELECT/getUsers() che porterebbero 16 campi inutili qui.
export async function getAuditLogUsernames(): Promise<string[]> {
  await requireAdmin();
  const rows = await prisma.utente.findMany({
    select: { username: true },
    orderBy: { username: "asc" },
  });
  return rows.map((r) => r.username);
}
