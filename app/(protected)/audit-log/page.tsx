import type { Metadata } from "next";
import { getAuditLog } from "@/lib/data/audit-log";
import { AuditLogManager } from "@/components/audit-log/audit-log-manager";

export const metadata: Metadata = {
  title: "Audit log",
};

export default async function AuditLogPage() {
  const entries = await getAuditLog();
  return <AuditLogManager entries={entries} />;
}
