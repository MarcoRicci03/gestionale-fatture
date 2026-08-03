"use client";

import { useEffect, useRef, useState } from "react";
import type { InvoiceFilters } from "./invoice-filters";

type UseInvoiceSelectionOptions = {
  invoices: { id: number }[];
  filters: InvoiceFilters;
  page: number;
};

export function useInvoiceSelection({
  invoices,
  filters,
  page,
}: UseInvoiceSelectionOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Azzera la selezione ogni volta che filtri o pagina cambiano (nuova
  // navigazione dal server), per evitare di esportare "a sorpresa" righe non
  // più visibili. Aggiornamento di stato durante il render (pattern
  // consigliato da React per "adjusting state when a prop changes"), non in
  // un effect, per non innescare un render a cascata evitabile.
  const [prevFilters, setPrevFilters] = useState(filters);
  const [prevPage, setPrevPage] = useState(page);
  if (filters !== prevFilters || page !== prevPage) {
    setPrevFilters(filters);
    setPrevPage(page);
    setSelectedIds(new Set());
  }

  useEffect(() => {
    if (!selectAllRef.current) return;
    const selectedInView = invoices.filter((i) => selectedIds.has(i.id)).length;
    selectAllRef.current.indeterminate =
      selectedInView > 0 && selectedInView < invoices.length;
  }, [selectedIds, invoices]);

  const toggleSelected = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(invoices.map((i) => i.id)) : new Set());
  };

  return { selectedIds, selectAllRef, toggleSelected, toggleSelectAll };
}
