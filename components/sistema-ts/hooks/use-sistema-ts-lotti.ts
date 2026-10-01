"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isDataPagamentoFutura } from "@/lib/utils/date";
import type { FatturaTsListItem } from "@/lib/data/sistema-ts";
import type { ReadinessFilter } from "../types";

export type UseSistemaTsLottiProps = {
  fatture: FatturaTsListItem[];
  initialFilters: {
    dateFrom?: string;
    dateTo?: string;
    stato?: string;
  };
};

export function isInvoiceFuture(f: FatturaTsListItem): boolean {
  return typeof f.isDataFutura === "boolean"
    ? f.isDataFutura
    : isDataPagamentoFutura(f.data_pagamento, f.data);
}

export function isInvoiceWithAnomalies(f: FatturaTsListItem): boolean {
  return typeof f.haAnomalie === "boolean"
    ? f.haAnomalie
    : !f.cfValido || !f.importoValido;
}

export function isInvoiceReady(f: FatturaTsListItem): boolean {
  return typeof f.isProntaPerInvio === "boolean"
    ? f.isProntaPerInvio
    : f.stato_ts === "DA_INVIARE" && !isInvoiceFuture(f) && !isInvoiceWithAnomalies(f);
}

export function useSistemaTsLotti({
  fatture,
  initialFilters,
}: UseSistemaTsLottiProps) {
  const router = useRouter();
  const [prevFilters, setPrevFilters] = useState(initialFilters);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(initialFilters.dateTo ?? "");
  const [statoFilter, setStatoFilter] = useState(initialFilters.stato ?? "DA_INVIARE");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("pronte");

  if (
    initialFilters.dateFrom !== prevFilters.dateFrom ||
    initialFilters.dateTo !== prevFilters.dateTo ||
    initialFilters.stato !== prevFilters.stato
  ) {
    setPrevFilters(initialFilters);
    setDateFrom(initialFilters.dateFrom ?? "");
    setDateTo(initialFilters.dateTo ?? "");
    setStatoFilter(initialFilters.stato ?? "DA_INVIARE");
    setSelectedIds(new Set());
  }

  // Conteggi e partizionamento per le pillole quando lo stato è DA_INVIARE
  const daInviareFatture = useMemo(
    () => fatture.filter((f) => f.stato_ts === "DA_INVIARE"),
    [fatture]
  );

  const pronteFatture = useMemo(
    () => daInviareFatture.filter(isInvoiceReady),
    [daInviareFatture]
  );

  const daCorreggereFatture = useMemo(
    () => daInviareFatture.filter(isInvoiceWithAnomalies),
    [daInviareFatture]
  );

  const futureFatture = useMemo(
    () => daInviareFatture.filter((f) => !isInvoiceWithAnomalies(f) && isInvoiceFuture(f)),
    [daInviareFatture]
  );

  // Fatture visualizzate nella tabella/cards
  const displayedFatture = useMemo(() => {
    if (statoFilter !== "DA_INVIARE") {
      return fatture;
    }
    switch (readinessFilter) {
      case "pronte":
        return pronteFatture;
      case "da_correggere":
        return daCorreggereFatture;
      case "future":
        return futureFatture;
      case "tutte":
        return daInviareFatture;
      default:
        return pronteFatture;
    }
  }, [statoFilter, readinessFilter, fatture, pronteFatture, daCorreggereFatture, futureFatture, daInviareFatture]);

  // Selezionabili per lotto invio: solo ed esclusivamente fatture pronte
  const selectableFatture = useMemo(
    () => displayedFatture.filter(isInvoiceReady),
    [displayedFatture]
  );

  const allSelectableChecked =
    selectableFatture.length > 0 &&
    selectableFatture.every((f) => selectedIds.has(f.id));

  const toggleSelectAll = () => {
    if (allSelectableChecked) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableFatture.map((f) => f.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectedFatture = useMemo(
    () => fatture.filter((f) => selectedIds.has(f.id)),
    [fatture, selectedIds]
  );

  const selectedTotalImporto = useMemo(
    () => selectedFatture.reduce((sum, f) => sum + f.prezzo_totale, 0),
    [selectedFatture]
  );

  const invalidCfCount = useMemo(
    () => selectedFatture.filter((f) => !f.cfValido).length,
    [selectedFatture]
  );

  const invalidImportoCount = useMemo(
    () => selectedFatture.filter((f) => !f.importoValido).length,
    [selectedFatture]
  );

  const futureDateCount = useMemo(
    () => selectedFatture.filter((f) => f.isDataFutura).length,
    [selectedFatture]
  );

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (statoFilter) params.set("stato", statoFilter);
    router.push(`/sistema-ts?${params.toString()}`);
  };

  const handleResetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setStatoFilter("DA_INVIARE");
    setReadinessFilter("pronte");
    setSelectedIds(new Set());
    router.push("/sistema-ts?stato=DA_INVIARE");
  };

  return {
    selectedIds,
    setSelectedIds,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    statoFilter,
    setStatoFilter,
    readinessFilter,
    setReadinessFilter,
    isInvoiceFuture,
    isInvoiceWithAnomalies,
    isInvoiceReady,
    daInviareFatture,
    pronteFatture,
    daCorreggereFatture,
    futureFatture,
    displayedFatture,
    selectableFatture,
    allSelectableChecked,
    toggleSelectAll,
    toggleSelect,
    selectedFatture,
    selectedTotalImporto,
    invalidCfCount,
    invalidImportoCount,
    futureDateCount,
    handleApplyFilters,
    handleResetFilters,
  };
}
