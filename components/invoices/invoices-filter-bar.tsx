"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Pagante, Paziente } from "@prisma/client";
import type { InvoiceFilters } from "./invoice-filters";

// Il componente Select tratta il valore stringa vuota come "nessuna
// selezione" (vedi hasSelectedValue in @base-ui/react/select/store.js: usa
// stringifyAsValue(value) !== '' per decidere se mostrare l'etichetta), per
// cui l'opzione "Tutti"/"Tutte" non può usare "" come value altrimenti la
// SelectValue nel trigger resta vuota. Si usa un sentinel non vuoto solo nel
// value space del Select, mappato da/verso "" (che resta il significato di
// "nessun filtro" nello stato di InvoicesManager).
const ALL_VALUE = "__ALL__";
const toSelectValue = (value: string) => (value === "" ? ALL_VALUE : value);
const fromSelectValue = (value: string | null) =>
  value === ALL_VALUE || value == null ? "" : value;

type PersonaSuggestion = {
  key: string;
  label: string;
  kind: "Pagante" | "Paziente";
};

function usePersonaSuggestions(
  payers: Pagante[],
  patients: Paziente[]
): PersonaSuggestion[] {
  return useMemo(
    () => [
      ...payers.map((p) => ({
        key: `pagante-${p.id}`,
        label: `${p.cognome} ${p.nome}`,
        kind: "Pagante" as const,
      })),
      ...patients.map((p) => ({
        key: `paziente-${p.id}`,
        label: `${p.cognome} ${p.nome}`,
        kind: "Paziente" as const,
      })),
    ],
    [payers, patients]
  );
}

const PERSONA_DEBOUNCE_MS = 300;

type PersonaSearchFieldProps = {
  value: string;
  onValueChange: (value: string) => void;
  suggestions: PersonaSuggestion[];
};

function PersonaSearchField({
  value,
  onValueChange,
  suggestions,
}: PersonaSearchFieldProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExternalValue = useRef(value);

  // Se il valore controllato cambia dall'esterno (es. "Reset filtri", o
  // back/forward del browser che riporta a un altro URL), risincronizza il
  // buffer locale. Non lo fa se il cambiamento coincide con l'ultimo valore
  // già inviato da qui (altrimenti il proprio debounce si auto-annullerebbe
  // ogni volta che onValueChange fa arrivare filters aggiornati dal server).
  useEffect(() => {
    if (value !== lastExternalValue.current) {
      setInputValue(value);
      lastExternalValue.current = value;
    }
  }, [value]);

  const flush = (next: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    lastExternalValue.current = next;
    onValueChange(next);
  };

  const handleChange = (next: string) => {
    setInputValue(next);
    setOpen(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      lastExternalValue.current = next;
      onValueChange(next);
    }, PERSONA_DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const filtered = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) return [];
    return suggestions
      .filter((s) => s.label.toLowerCase().includes(query))
      .slice(0, 8);
  }, [suggestions, inputValue]);

  const showSuggestions = open && filtered.length > 0;

  return (
    <div className="relative space-y-2">
      <Label htmlFor="filtro-persona">Pagante o paziente</Label>
      <Input
        id="filtro-persona"
        placeholder="Cerca per nome..."
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          flush(inputValue);
        }}
        role="combobox"
        aria-expanded={showSuggestions}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {showSuggestions && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {filtered.map((s) => (
            <li key={s.key} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  flush(s.label);
                }}
              >
                <span>{s.label}</span>
                <span className="text-xs text-muted-foreground">{s.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type InvoicesFilterBarProps = {
  filters: InvoiceFilters;
  onChange: (patch: Partial<InvoiceFilters>) => void;
  onReset: () => void;
  payers: Pagante[];
  patients: Paziente[];
  years: number[];
};

export function InvoicesFilterBar({
  filters,
  onChange,
  onReset,
  payers,
  patients,
  years,
}: InvoicesFilterBarProps) {
  const personaSuggestions = usePersonaSuggestions(payers, patients);

  return (
    <div className="rounded-lg border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="filtro-data-da">Data da</Label>
          <Input
            id="filtro-data-da"
            type="date"
            value={filters.dataDa}
            onChange={(e) => onChange({ dataDa: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="filtro-data-a">Data a</Label>
          <Input
            id="filtro-data-a"
            type="date"
            value={filters.dataA}
            onChange={(e) => onChange({ dataA: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="filtro-anno">Anno</Label>
          <Select
            value={toSelectValue(filters.anno)}
            onValueChange={(v) => onChange({ anno: fromSelectValue(v) })}
          >
            <SelectTrigger id="filtro-anno" className="w-full">
              <SelectValue>{(v: string) => (v === ALL_VALUE ? "Tutti" : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Tutti</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <PersonaSearchField
          value={filters.persona}
          onValueChange={(persona) => onChange({ persona })}
          suggestions={personaSuggestions}
        />

        <div className="space-y-2">
          <Label htmlFor="filtro-mod-pag">Modalità pagamento</Label>
          <Select
            value={toSelectValue(filters.modPag)}
            onValueChange={(v) => onChange({ modPag: fromSelectValue(v) })}
          >
            <SelectTrigger id="filtro-mod-pag" className="w-full">
              <SelectValue>{(v: string) => (v === ALL_VALUE ? "Tutte" : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Tutte</SelectItem>
              <SelectItem value="CONTANTI">CONTANTI</SelectItem>
              <SelectItem value="CARTA">CARTA</SelectItem>
              <SelectItem value="BONIFICO">BONIFICO</SelectItem>
            </SelectContent>
          </Select>
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
