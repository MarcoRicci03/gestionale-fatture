"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit/actions";
import { EMPTY_AUDIT_LOG_FILTERS, type AuditLogFilters } from "@/lib/audit/list-query";
import { AuditLogFilterBar } from "@/components/audit-log/audit-log-filter-bar";
import { ListPagination } from "@/components/ui/list-pagination";
import { AUDIT_LOG_PAGE_SIZE } from "@/lib/constants/audit-log";
import type { AuditLogEntry } from "@/lib/data/audit-log-select";

type AuditLogManagerProps = {
  entries: AuditLogEntry[];
  totalCount: number;
  page: number;
  filters: AuditLogFilters;
  usernames: string[];
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
// fino a AUDIT_LOG_PAGE_SIZE eventi per pagina la pagina non deve allungarsi
// indefinitamente, la lista scrolla al suo interno mentre filtri e
// intestazione restano fissi sopra.
const SCROLL_AREA_CLASS = "max-h-[65vh] overflow-y-auto";

export function AuditLogManager({
  entries,
  totalCount,
  page,
  filters,
  usernames,
}: AuditLogManagerProps) {
  const router = useRouter();
  const pathname = usePathname();

  // LOG-03: filtri e paginazione sono ora lato server (filters/page arrivano
  // da searchParams via parseAuditLogListQuery, non più uno useState locale
  // che filtrava un array già troncato a 200 righe). Stesso pattern di
  // PatientsManager: latestStateRef tiene traccia dello stato più recente
  // verso cui si è navigato, aggiornato sincronamente a ogni chiamata di
  // navigate() (non solo quando le prop cambiano), per evitare che due
  // navigazioni ravvicinate leggano entrambe una closure stale.
  const latestStateRef = useRef({ filters, page });
  useEffect(() => {
    latestStateRef.current = { filters, page };
  }, [filters, page]);

  function navigate(next: { filters: AuditLogFilters; page: number }) {
    latestStateRef.current = next;
    const params = new URLSearchParams();
    if (next.filters.dataDa) params.set("dataDa", next.filters.dataDa);
    if (next.filters.dataA) params.set("dataA", next.filters.dataA);
    if (next.filters.utente) params.set("utente", next.filters.utente);
    if (next.filters.azione) params.set("azione", next.filters.azione);
    if (next.filters.ricerca) params.set("ricerca", next.filters.ricerca);
    if (next.page > 1) params.set("page", String(next.page));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const handleFilterChange = (patch: Partial<AuditLogFilters>) => {
    navigate({
      filters: { ...latestStateRef.current.filters, ...patch },
      page: 1,
    });
  };
  // Bypassa navigate() per evitare un "?" residuo senza parametri (stesso
  // pattern di handleReset in InvoicesManager): qui il default è "nessun
  // filtro", quindi tornare all'URL nudo equivale a resettare.
  const handleFilterReset = () => {
    latestStateRef.current = { filters: EMPTY_AUDIT_LOG_FILTERS, page: 1 };
    router.replace(pathname, { scroll: false });
  };
  const handlePageChange = (nextPage: number) =>
    navigate({ filters: latestStateRef.current.filters, page: nextPage });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="text-muted-foreground">
          {totalCount} event{totalCount === 1 ? "o" : "i"}: accessi e operazioni sensibili
        </p>
      </div>

      <AuditLogFilterBar
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleFilterReset}
        usernames={usernames}
      />

      {entries.length === 0 ? (
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
                {entries.map((entry) => (
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
            {entries.map((entry) => (
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

          <ListPagination
            page={page}
            totalCount={totalCount}
            pageSize={AUDIT_LOG_PAGE_SIZE}
            itemLabel="eventi"
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}
