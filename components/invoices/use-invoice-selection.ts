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

  // Azzera la selezione solo quando i filtri cambiano (nuovo set di ricerca),
  // MA NON quando cambia la pagina (vincolo critico di persistenza tra pagine).
  const [prevFilters, setPrevFilters] = useState(filters);
  if (filters !== prevFilters) {
    setPrevFilters(filters);
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
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        invoices.forEach((i) => next.add(i.id));
      } else {
        invoices.forEach((i) => next.delete(i.id));
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  return { selectedIds, selectAllRef, toggleSelected, toggleSelectAll, clearSelection };
}
