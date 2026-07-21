import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { AUDIT_LOG_SELECT, type AuditLogEntry } from "./audit-log-select";

// take: 200, stesso pattern di getLatestInvoices(limit) — sufficiente per una
// prima consultazione senza costruire un componente di paginazione generico
// (nessun precedente di paginazione vera nel progetto). Non applica scoping
// per id_Utente: un admin deve poter vedere gli eventi di tutti gli utenti,
// non solo i propri (requireAdmin() lo garantisce già).
export async function getAuditLog(): Promise<AuditLogEntry[]> {
  await requireAdmin();
  return prisma.auditLog.findMany({
    select: AUDIT_LOG_SELECT,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
