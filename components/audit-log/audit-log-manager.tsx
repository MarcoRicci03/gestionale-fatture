"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit/actions";
import {
  EMPTY_AUDIT_LOG_FILTERS,
  filterAuditLogEntries,
  getDistinctUsernames,
  type AuditLogFilters,
} from "@/lib/audit/filter-audit-log";
import { AuditLogFilterBar } from "@/components/audit-log/audit-log-filter-bar";
import type { AuditLogEntry } from "@/lib/data/audit-log-select";

type AuditLogManagerProps = {
  entries: AuditLogEntry[];
};

function formatAzione(azione: string): string {
  return AUDIT_ACTION_LABELS[azione as AuditAction] ?? azione;
}

function formatEntita(entry: AuditLogEntry): string {
  if (!entry.entita) return "-";
  return entry.entitaId ? `${entry.entita} #${entry.entitaId}` : entry.entita;
}

function formatData(createdAt: Date): string {
  return createdAt.toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function formatMeta(meta: AuditLogEntry["meta"]): string {
  if (!meta) return "-";
  return JSON.stringify(meta);
}

// Altezza fissa dell'area scrollabile (tabella desktop e card mobile): con
// fino a 200 eventi la pagina non deve allungarsi indefinitamente, la lista
// scrolla al suo interno mentre filtri e intestazione restano fissi sopra.
const SCROLL_AREA_CLASS = "max-h-[65vh] overflow-y-auto";

export function AuditLogManager({ entries }: AuditLogManagerProps) {
  const [filters, setFilters] = useState<AuditLogFilters>(EMPTY_AUDIT_LOG_FILTERS);

  const usernames = useMemo(() => getDistinctUsernames(entries), [entries]);
  const filteredEntries = useMemo(
    () => filterAuditLogEntries(entries, filters),
    [entries, filters]
  );

  const handleFilterChange = (patch: Partial<AuditLogFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));
  const handleFilterReset = () => setFilters(EMPTY_AUDIT_LOG_FILTERS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="text-muted-foreground">
          {filteredEntries.length} di {entries.length} eventi: accessi e operazioni sensibili
        </p>
      </div>

      <AuditLogFilterBar
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleFilterReset}
        usernames={usernames}
      />

      {filteredEntries.length === 0 ? (
        <p className="text-muted-foreground">Nessun evento corrisponde ai filtri selezionati.</p>
      ) : (
        <>
          <div className={`hidden rounded-lg border md:block ${SCROLL_AREA_CLASS}`}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Data e ora</TableHead>
                  <TableHead>Utente</TableHead>
                  <TableHead>Azione</TableHead>
                  <TableHead>Entità</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Dettagli</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatData(entry.createdAt)}
                    </TableCell>
                    <TableCell>{entry.utente?.username ?? "-"}</TableCell>
                    <TableCell>{formatAzione(entry.azione)}</TableCell>
                    <TableCell>{formatEntita(entry)}</TableCell>
                    <TableCell>{entry.ip ?? "-"}</TableCell>
                    <TableCell
                      className="max-w-xs truncate font-mono text-xs text-muted-foreground"
                      title={entry.meta ? JSON.stringify(entry.meta) : undefined}
                    >
                      {formatMeta(entry.meta)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className={`space-y-3 rounded-lg md:hidden ${SCROLL_AREA_CLASS}`}>
            {filteredEntries.map((entry) => (
              <li key={entry.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{formatAzione(entry.azione)}</p>
                  <p className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatData(entry.createdAt)}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Utente: {entry.utente?.username ?? "-"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Entità: {formatEntita(entry)}
                </p>
                <p className="text-sm text-muted-foreground">
                  IP: {entry.ip ?? "-"}
                </p>
                {entry.meta ? (
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    {formatMeta(entry.meta)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
