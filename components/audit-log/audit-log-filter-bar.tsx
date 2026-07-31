// components/audit-log/audit-log-filter-bar.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchField } from "@/components/ui/search-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit/actions";
import type { AuditLogFilters } from "@/lib/audit/list-query";

// Stesso sentinel/mapping di InvoicesFilterBar (components/invoices/invoices-filter-bar.tsx):
// il Select tratta "" come "nessuna selezione" e non mostrerebbe l'etichetta
// "Tutti"/"Tutte" nel trigger, per cui serve un valore non vuoto solo nel
// value space del Select.
const ALL_VALUE = "__ALL__";
const toSelectValue = (value: string) => (value === "" ? ALL_VALUE : value);
const fromSelectValue = (value: string | null) =>
  value === ALL_VALUE || value == null ? "" : value;

const AZIONE_OPTIONS: { value: AuditAction; label: string }[] = Object.values(AUDIT_ACTIONS)
  .map((value) => ({ value, label: AUDIT_ACTION_LABELS[value] }))
  .sort((a, b) => a.label.localeCompare(b.label, "it"));

type AuditLogFilterBarProps = {
  filters: AuditLogFilters;
  onChange: (patch: Partial<AuditLogFilters>) => void;
  onReset: () => void;
  usernames: string[];
};

export function AuditLogFilterBar({
  filters,
  onChange,
  onReset,
  usernames,
}: AuditLogFilterBarProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="audit-filtro-data-da">Data da</Label>
          <Input
            id="audit-filtro-data-da"
            type="date"
            value={filters.dataDa}
            onChange={(e) => onChange({ dataDa: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="audit-filtro-data-a">Data a</Label>
          <Input
            id="audit-filtro-data-a"
            type="date"
            value={filters.dataA}
            onChange={(e) => onChange({ dataA: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="audit-filtro-utente">Utente</Label>
          <Select
            value={toSelectValue(filters.utente)}
            onValueChange={(v) => onChange({ utente: fromSelectValue(v) })}
          >
            <SelectTrigger id="audit-filtro-utente" className="w-full">
              <SelectValue>{(v: string) => (v === ALL_VALUE ? "Tutti" : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Tutti</SelectItem>
              {usernames.map((username) => (
                <SelectItem key={username} value={username}>
                  {username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="audit-filtro-azione">Azione</Label>
          <Select
            value={toSelectValue(filters.azione)}
            onValueChange={(v) => onChange({ azione: fromSelectValue(v) })}
          >
            <SelectTrigger id="audit-filtro-azione" className="w-full">
              <SelectValue>{(v: string) => (v === ALL_VALUE ? "Tutte" : AUDIT_ACTION_LABELS[v as AuditAction])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Tutte</SelectItem>
              {AZIONE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* LOG-03: ora ogni cambio filtro innesca un vero round-trip server
            (prima era un filtro client istantaneo su un array già caricato):
            senza debounce, ogni carattere digitato qui farebbe una
            richiesta. Stesso componente già usato da patients/payers
            manager. */}
        <div className="sm:col-span-2 lg:col-span-1">
          <SearchField
            id="audit-filtro-ricerca"
            label="Entità o IP"
            placeholder="Cerca per entità, id o IP..."
            value={filters.ricerca}
            onValueChange={(value) => onChange({ ricerca: value })}
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button variant="outline" size="sm" onClick={onReset}>
          Reset filtri
        </Button>
      </div>
    </div>
  );
}
