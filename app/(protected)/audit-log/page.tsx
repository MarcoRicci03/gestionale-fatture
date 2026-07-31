import type { Metadata } from "next";
import { getAuditLog, getAuditLogUsernames } from "@/lib/data/audit-log";
import { AuditLogManager } from "@/components/audit-log/audit-log-manager";
import { parseAuditLogListQuery } from "@/lib/validations/audit-log-list-query";

export const metadata: Metadata = {
  title: "Audit log",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const { filters, page: requestedPage } = parseAuditLogListQuery(rawParams);

  const [{ entries, totalCount, page }, usernames] = await Promise.all([
    getAuditLog(filters, requestedPage),
    getAuditLogUsernames(),
  ]);

  return (
    <AuditLogManager
      entries={entries}
      totalCount={totalCount}
      page={page}
      filters={filters}
      usernames={usernames}
    />
  );
}
