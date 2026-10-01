"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { InvoiceFilters } from "./invoice-filters";
import { INVOICES_PAGE_SIZE } from "@/lib/constants/invoices";

type UseInvoiceFiltersOptions = {
  filters: InvoiceFilters;
  pageSize?: number;
};

export function useInvoiceFilters({ filters, pageSize = INVOICES_PAGE_SIZE }: UseInvoiceFiltersOptions) {
  const router = useRouter();
  const pathname = usePathname();

  // Tiene traccia dei filtri più recenti verso cui si è navigato, aggiornata
  // sincronamente ad ogni chiamata a `navigate()` (non solo quando la prop
  // `filters` cambia): `filters` è una prop da Server Component e resta al
  // valore precedente finché il round-trip RSC non è tornato, quindi due
  // cambi filtro ravvicinati (es. il flush del debounce di "persona" seguito
  // a ruota da un click su un Select) leggerebbero entrambi la STESSA
  // `filters` stale dalla chiusura e il secondo `navigate` perderebbe
  // silenziosamente la patch del primo. Risincronizzata in un effect (non
  // durante il render, vietato per i ref da react-hooks/refs) quando una
  // navigazione esterna reale arriva (prop `filters` cambiata, es.
  // back/forward del browser), per non restare disallineata.
  const latestFiltersRef = useRef(filters);
  useEffect(() => {
    latestFiltersRef.current = filters;
  }, [filters]);

  const latestPageSizeRef = useRef(pageSize);
  useEffect(() => {
    latestPageSizeRef.current = pageSize;
  }, [pageSize]);

  function navigate(nextFilters: InvoiceFilters, nextPage: number, nextPageSize?: number) {
    latestFiltersRef.current = nextFilters;
    const effectivePageSize = nextPageSize ?? latestPageSizeRef.current;
    latestPageSizeRef.current = effectivePageSize;

    const params = new URLSearchParams();
    params.set("f", "1");
    if (nextFilters.dataDa) params.set("dataDa", nextFilters.dataDa);
    if (nextFilters.dataA) params.set("dataA", nextFilters.dataA);
    if (nextFilters.persona) params.set("persona", nextFilters.persona);
    if (nextFilters.modPag) params.set("modPag", nextFilters.modPag);
    if (nextFilters.anno) params.set("anno", nextFilters.anno);
    if (nextPage > 1) params.set("page", String(nextPage));
    if (effectivePageSize !== INVOICES_PAGE_SIZE) {
      params.set("pageSize", String(effectivePageSize));
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const handleFiltersChange = (patch: Partial<InvoiceFilters>) => {
    navigate({ ...latestFiltersRef.current, ...patch }, 1);
  };

  const handleReset = () => {
    router.replace(pathname, { scroll: false });
  };

  const handlePageChange = (nextPage: number) => {
    navigate(latestFiltersRef.current, nextPage);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    navigate(latestFiltersRef.current, 1, nextPageSize);
  };

  return { handleFiltersChange, handleReset, handlePageChange, handlePageSizeChange };
}

