import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit/actions";
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
  const json = JSON.stringify(meta);
  return json.length > 80 ? `${json.slice(0, 80)}…` : json;
}

export function AuditLogManager({ entries }: AuditLogManagerProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="text-muted-foreground">
          Ultimi {entries.length} eventi: accessi e operazioni sensibili
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground">Nessun evento registrato.</p>
      ) : (
        <>
          <div className="hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
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
                    <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                      {formatMeta(entry.meta)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 md:hidden">
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
        </>
      )}
    </div>
  );
}
