"use client";

import { useState, useMemo } from "react";
import type { TrasmissioneItem } from "../types";

export type UseSistemaTsStoricoProps = {
  trasmissioni: TrasmissioneItem[];
};

export function useSistemaTsStorico({ trasmissioni }: UseSistemaTsStoricoProps) {
  const [expandedTransmissions, setExpandedTransmissions] = useState<Set<number>>(new Set());
  const [storicoSearch, setStoricoSearch] = useState("");
  const [storicoStato, setStoricoStato] = useState("ALL");
  const [storicoDateFrom, setStoricoDateFrom] = useState("");
  const [storicoDateTo, setStoricoDateTo] = useState("");

  const toggleExpanded = (id: number) => {
    setExpandedTransmissions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleResetStoricoFilters = () => {
    setStoricoSearch("");
    setStoricoStato("ALL");
    setStoricoDateFrom("");
    setStoricoDateTo("");
  };

  const hasActiveStoricoFilters = Boolean(
    storicoSearch.trim() ||
    storicoStato !== "ALL" ||
    storicoDateFrom ||
    storicoDateTo
  );

  const filteredTrasmissioni = useMemo(() => {
    return trasmissioni.filter((t) => {
      // Filtro stato elaborazione
      if (storicoStato !== "ALL") {
        if (storicoStato === "SCARTATE") {
          const isScartato =
            t.statoElaborazione === "4" ||
            t.statoElaborazione === "5" ||
            (t.numScartati != null && t.numScartati > 0);
          if (!isScartato) return false;
        } else if (t.statoElaborazione !== storicoStato) {
          return false;
        }
      }

      // Filtro data da
      if (storicoDateFrom) {
        const from = new Date(storicoDateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(t.dataInvio) < from) return false;
      }

      // Filtro data a
      if (storicoDateTo) {
        const to = new Date(storicoDateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(t.dataInvio) > to) return false;
      }

      // Filtro ricerca testuale
      if (storicoSearch.trim()) {
        const q = storicoSearch.trim().toLowerCase();
        const matchesProtocollo = t.protocollo.toLowerCase().includes(q);
        const matchesNomeFile = t.nomeFile.toLowerCase().includes(q);
        const matchesCodiceEsito = (t.codiceEsito ?? "").toLowerCase().includes(q);
        const matchesDescrizioneEsito = (t.descrizioneEsito ?? "").toLowerCase().includes(q);
        const matchesFattura = t.fatture.some((f) => {
          const numDoc = String(f.n_fattura);
          const anno = String(f.anno);
          const pagante = f.paganteNome.toLowerCase();
          const cf = (f.paganteCf ?? "").toLowerCase();
          const errors = f.errori.some(
            (e) =>
              e.codiceErrore.toLowerCase().includes(q) ||
              e.descrizione.toLowerCase().includes(q)
          );
          return (
            numDoc.includes(q) ||
            `${numDoc}/${anno}`.includes(q) ||
            pagante.includes(q) ||
            cf.includes(q) ||
            errors
          );
        });

        if (
          !matchesProtocollo &&
          !matchesNomeFile &&
          !matchesCodiceEsito &&
          !matchesDescrizioneEsito &&
          !matchesFattura
        ) {
          return false;
        }
      }

      return true;
    });
  }, [trasmissioni, storicoStato, storicoDateFrom, storicoDateTo, storicoSearch]);

  return {
    expandedTransmissions,
    toggleExpanded,
    storicoSearch,
    setStoricoSearch,
    storicoStato,
    setStoricoStato,
    storicoDateFrom,
    setStoricoDateFrom,
    storicoDateTo,
    setStoricoDateTo,
    handleResetStoricoFilters,
    hasActiveStoricoFilters,
    filteredTrasmissioni,
  };
}
