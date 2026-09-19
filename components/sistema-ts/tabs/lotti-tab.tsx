"use client";

import {
  SendHorizontal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  RotateCcw,
  Ban,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import type { FatturaTsListItem } from "@/lib/data/sistema-ts";
import type { useSistemaTsLotti } from "../hooks/use-sistema-ts-lotti";
import { formatCurrency, formatDate, type CancelInvoiceData } from "../types";

export type LottiTabProps = {
  hasSettings: boolean;
  isPending: boolean;
  lotti: ReturnType<typeof useSistemaTsLotti>;
  onOpenConfirmBatch: () => void;
  onFixInvoice: (invoice: FatturaTsListItem) => void;
  onOpenCancelModal: (data: CancelInvoiceData) => void;
  onRipristina: (id: number) => void;
};

export function LottiTab({
  hasSettings,
  isPending,
  lotti,
  onOpenConfirmBatch,
  onFixInvoice,
  onOpenCancelModal,
  onRipristina,
}: LottiTabProps) {
  const {
    selectedIds,
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
  } = lotti;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Filtri */}
      <div className="shrink-0 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-4 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="dateFrom" className="text-xs">Data da</Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dateTo" className="text-xs">Data a</Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="statoFilter" className="text-xs">Stato Fattura</Label>
            <select
              id="statoFilter"
              value={statoFilter}
              onChange={(e) => setStatoFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="DA_INVIARE">Da inviare</option>
              <option value="IN_TRASMISSIONE">In trasmissione</option>
              <option value="INVIATA">Già inviate</option>
              <option value="DA_CANCELLARE_SU_TS">Da cancellare su TS</option>
              <option value="ANNULLATA_TS">Annullate</option>
              <option value="ALL">Tutte le fatture</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleApplyFilters} className="flex-1">
              <Filter className="mr-2 h-4 w-4" />
              Filtra
            </Button>
            <Button variant="outline" onClick={handleResetFilters} aria-label="Azzera filtri" title="Azzera filtri">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Pillole Rapide di Navigazione quando lo stato è DA_INVIARE */}
      {statoFilter === "DA_INVIARE" && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReadinessFilter("pronte")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              readinessFilter === "pronte"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Pronte all&apos;invio</span>
            <span
              className={`ml-1 rounded-full px-1.5 py-0.2 text-[11px] ${
                readinessFilter === "pronte"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background text-foreground"
              }`}
            >
              {pronteFatture.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setReadinessFilter("da_correggere")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              readinessFilter === "da_correggere"
                ? "bg-destructive text-destructive-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Da correggere</span>
            <span
              className={`ml-1 rounded-full px-1.5 py-0.2 text-[11px] ${
                readinessFilter === "da_correggere"
                  ? "bg-destructive-foreground/20 text-destructive-foreground"
                  : daCorreggereFatture.length > 0
                  ? "bg-destructive/15 text-destructive font-semibold"
                  : "bg-background text-foreground"
              }`}
            >
              {daCorreggereFatture.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setReadinessFilter("future")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              readinessFilter === "future"
                ? "bg-amber-600 text-white shadow-sm dark:bg-amber-700"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Incassi futuri</span>
            <span
              className={`ml-1 rounded-full px-1.5 py-0.2 text-[11px] ${
                readinessFilter === "future"
                  ? "bg-white/20 text-white"
                  : futureFatture.length > 0
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 font-semibold"
                  : "bg-background text-foreground"
              }`}
            >
              {futureFatture.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setReadinessFilter("tutte")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              readinessFilter === "tutte"
                ? "bg-secondary text-secondary-foreground shadow-sm ring-1 ring-border"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Tutte</span>
            <span
              className={`ml-1 rounded-full px-1.5 py-0.2 text-[11px] ${
                readinessFilter === "tutte"
                  ? "bg-background text-foreground font-semibold"
                  : "bg-background text-foreground"
              }`}
            >
              {daInviareFatture.length}
            </span>
          </button>
        </div>
      )}

      {displayedFatture.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">
            {statoFilter === "DA_INVIARE"
              ? readinessFilter === "pronte"
                ? "Nessuna fattura pronta per l'invio"
                : readinessFilter === "da_correggere"
                ? "Nessuna fattura con anomalie da correggere"
                : readinessFilter === "future"
                ? "Nessuna fattura con data di incasso futura"
                : "Nessuna fattura da inviare trovata"
              : "Nessuna fattura trovata"}
          </p>
          <p className="text-sm text-muted-foreground">
            {statoFilter === "DA_INVIARE" && readinessFilter === "pronte" && (futureFatture.length > 0 || daCorreggereFatture.length > 0)
              ? `Ci sono ${futureFatture.length} fatture con incasso futuro e ${daCorreggereFatture.length} con anomalie da correggere.`
              : "Non ci sono fatture corrispondenti ai filtri impostati."}
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          {/* Vista Desktop Table (hidden lg:block) */}
          <div className="hidden flex-1 min-h-56 overflow-auto rounded-lg border border-border bg-card lg:block">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={allSelectableChecked}
                      onChange={toggleSelectAll}
                      disabled={selectableFatture.length === 0}
                      className="h-4 w-4 rounded border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Seleziona tutte le fatture"
                    />
                  </TableHead>
                  <TableHead>N. Fattura</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Intestatario (Pagante)</TableHead>
                  <TableHead>CF Pagante (Assistito)</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Bollo</TableHead>
                  <TableHead>Tracciato</TableHead>
                  <TableHead>Stato TS</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedFatture.map((f) => {
                  const isFuture = isInvoiceFuture(f);
                  const hasAnomalies = isInvoiceWithAnomalies(f);
                  const isReady = isInvoiceReady(f);
                  const isSelectable = isReady;
                  const effectiveDate = f.dataEffettiva ?? (f.data_pagamento || f.data);
                  const isSelected = selectedIds.has(f.id);
                  const checkboxTooltip = !isSelectable
                    ? hasAnomalies
                      ? `Non selezionabile: ${f.cfErrore || f.importoErrore || "presenta anomalie da correggere"}`
                      : isFuture
                      ? `Non inviabile oggi: la data di incasso (${formatDate(effectiveDate)}) è successiva ad oggi (scarto ministeriale S036)`
                      : "Non selezionabile per l'invio"
                    : `Seleziona fattura ${f.n_fattura}`;

                  return (
                    <TableRow key={f.id} className={isSelected ? "bg-primary/5" : undefined}>
                      <TableCell>
                        <Tooltip content={checkboxTooltip}>
                          <span className="inline-block">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!isSelectable}
                              title={!isSelectable ? checkboxTooltip : undefined}
                              onChange={() => toggleSelect(f.id)}
                              className="h-4 w-4 rounded border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                              aria-label={`Seleziona fattura ${f.n_fattura}`}
                            />
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="font-medium">
                        {f.n_fattura}/{f.anno}
                      </TableCell>
                      <TableCell>
                        <div>{formatDate(f.data)}</div>
                        {f.data_pagamento && (
                          <Tooltip content="Data di effettivo incasso (principio di cassa per il 730 precompilato)">
                            <div className="text-xs text-muted-foreground inline-flex items-center gap-1 cursor-help">
                              <span>Incasso:</span>
                              <span className="font-medium text-foreground">{formatDate(f.data_pagamento)}</span>
                            </div>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{f.paganteNomeCompleto}</div>
                        {f.pazienteNomeCompleto && f.pazienteNomeCompleto !== f.paganteNomeCompleto && (
                          <div className="text-xs text-muted-foreground">
                            Paziente: {f.pazienteNomeCompleto}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.flag_opposizione ? (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            Opposizione
                          </span>
                        ) : f.cfValido ? (
                          <span className="font-mono text-xs text-foreground font-medium">
                            {f.paganteCf}
                          </span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-semibold text-destructive">
                              {f.paganteCf || "MANCANTE"}
                            </span>
                            <span className="text-[11px] text-destructive flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {f.cfErrore || "Codice Fiscale errato"}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <div>{formatCurrency(f.prezzo_totale)}</div>
                        {!f.importoValido && (
                          <div className="text-[11px] text-destructive font-semibold flex items-center justify-end gap-1 mt-0.5">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {f.importoErrore || "Importo non valido per TS"}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.richiedeBollo ? (
                          <div className="text-xs">
                            <span className="font-medium">{formatCurrency(f.bollo)}</span>
                            {f.bolloMancante ? (
                              <div className="text-[11px] text-destructive font-semibold flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                Codice assente
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {f.bolloCodice}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.pagamento_tracciato ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-400">
                            Sì ({f.mod_pag})
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-400">
                            No (Contanti)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.stato_ts === "DA_INVIARE" && !hasAnomalies && !isFuture && (
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-950/30 dark:text-blue-400">
                            Pronta
                          </span>
                        )}
                        {f.stato_ts === "DA_INVIARE" && hasAnomalies && (
                          <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/20 dark:bg-destructive/20 dark:text-destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" /> Da correggere
                          </span>
                        )}
                        {f.stato_ts === "DA_INVIARE" && !hasAnomalies && isFuture && (
                          <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-400">
                            <Clock className="mr-1 h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" /> Incasso futuro
                          </span>
                        )}
                        {f.stato_ts === "IN_TRASMISSIONE" && (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-400">
                            <Clock className="mr-1 h-3 w-3 animate-spin" /> In trasmissione
                          </span>
                        )}
                        {f.stato_ts === "INVIATA" && (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-400">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Inviata
                          </span>
                        )}
                        {f.stato_ts === "DA_CANCELLARE_SU_TS" && (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-400">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {f.protocollo_cancellazione_ts ? "Canc. in corso" : "Da cancellare"}
                          </span>
                        )}
                        {f.stato_ts === "ANNULLATA_TS" && (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-muted-foreground/20">
                            <Ban className="mr-1 h-3 w-3" /> Annullata
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {f.stato_ts === "DA_INVIARE" && (hasAnomalies || isFuture) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-7 text-xs",
                                hasAnomalies
                                  ? "text-destructive hover:bg-destructive/10"
                                  : "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-amber-300 dark:border-amber-800"
                              )}
                              onClick={() => onFixInvoice(f)}
                            >
                              Correggi
                            </Button>
                          )}
                          {(f.stato_ts === "INVIATA" || f.stato_ts === "DA_CANCELLARE_SU_TS") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() =>
                                onOpenCancelModal({
                                  id: f.id,
                                  n_fattura: f.n_fattura,
                                  anno: f.anno,
                                  data: f.data,
                                  paganteNome: f.paganteNomeCompleto,
                                })
                              }
                              disabled={isPending}
                            >
                              <Ban className="mr-1 h-3 w-3" />
                              Annulla TS
                            </Button>
                          )}
                          {f.stato_ts === "IN_TRASMISSIONE" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-amber-700 hover:text-amber-800"
                              onClick={() => onRipristina(f.id)}
                              disabled={isPending}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Sblocca
                            </Button>
                          )}
                          {f.stato_ts === "ANNULLATA_TS" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => onRipristina(f.id)}
                              disabled={isPending}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Ripristina
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Vista Mobile Cards (lg:hidden) */}
          <div className="space-y-3 lg:hidden">
            {displayedFatture.map((f) => {
              const isFuture = isInvoiceFuture(f);
              const hasAnomalies = isInvoiceWithAnomalies(f);
              const isReady = isInvoiceReady(f);
              const isSelectable = isReady;
              const isSelected = selectedIds.has(f.id);

              return (
                <Card
                  key={f.id}
                  className={cn(
                    "transition-colors",
                    isSelected ? "border-primary bg-primary/5" : "bg-card"
                  )}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isSelectable}
                          onChange={() => toggleSelect(f.id)}
                          className="h-4 w-4 rounded border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                        <div>
                          <div className="font-semibold text-sm">
                            Fattura #{f.n_fattura}/{f.anno}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(f.data)}
                            {f.data_pagamento && (
                              <span className="ml-2 text-foreground">
                                (Incasso: {formatDate(f.data_pagamento)})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-sm">
                          {formatCurrency(f.prezzo_totale)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {f.pagamento_tracciato ? "Tracciato" : "Contanti"}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs border-t border-border pt-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Intestatario:</span>
                        <span className="font-medium text-right">{f.paganteNomeCompleto}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Codice Fiscale:</span>
                        {f.flag_opposizione ? (
                          <span className="text-muted-foreground italic">Opposizione</span>
                        ) : f.cfValido ? (
                          <span className="font-mono font-medium">{f.paganteCf}</span>
                        ) : (
                          <span className="font-mono text-destructive font-semibold flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {f.paganteCf || "MANCANTE"}
                          </span>
                        )}
                      </div>
                      {f.richiedeBollo && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Bollo:</span>
                          <span className={cn(f.bolloMancante ? "text-destructive font-semibold" : "")}>
                            {formatCurrency(f.bollo)} {f.bolloCodice ? `(${f.bolloCodice})` : "(senza codice)"}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-muted-foreground">Stato TS:</span>
                        {f.stato_ts === "IN_TRASMISSIONE" && (
                          <span className="text-amber-600 font-medium inline-flex items-center gap-1">
                            <Clock className="h-3 w-3 animate-spin" /> In trasmissione
                          </span>
                        )}
                        {f.stato_ts === "DA_INVIARE" && hasAnomalies && (
                          <span className="text-destructive font-medium inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Da correggere
                          </span>
                        )}
                        {f.stato_ts === "DA_INVIARE" && !hasAnomalies && isFuture && (
                          <span className="text-amber-600 font-medium inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Incasso futuro
                          </span>
                        )}
                        {f.stato_ts === "DA_INVIARE" && isReady && (
                          <span className="text-blue-600 font-medium">Pronta</span>
                        )}
                        {f.stato_ts === "INVIATA" && (
                          <span className="text-emerald-600 font-medium">Inviata</span>
                        )}
                        {f.stato_ts === "DA_CANCELLARE_SU_TS" && (
                          <span className="text-amber-600 font-medium">
                            {f.protocollo_cancellazione_ts ? "Canc. in corso" : "Da cancellare"}
                          </span>
                        )}
                        {f.stato_ts === "ANNULLATA_TS" && (
                          <span className="text-muted-foreground font-medium">Annullata</span>
                        )}
                      </div>
                    </div>

                    {f.stato_ts === "DA_INVIARE" && (hasAnomalies || isFuture) && (
                      <div className="pt-2 flex justify-end border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-7 text-xs w-full",
                            hasAnomalies
                              ? "text-destructive hover:bg-destructive/10"
                              : "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-amber-300 dark:border-amber-800"
                          )}
                          onClick={() => onFixInvoice(f)}
                        >
                          Correggi per Sistema TS
                        </Button>
                      </div>
                    )}
                    {(f.stato_ts === "INVIATA" || f.stato_ts === "DA_CANCELLARE_SU_TS") && (
                      <div className="pt-2 flex justify-end border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            onOpenCancelModal({
                              id: f.id,
                              n_fattura: f.n_fattura,
                              anno: f.anno,
                              data: f.data,
                              paganteNome: f.paganteNomeCompleto,
                            })
                          }
                          disabled={isPending}
                        >
                          <Ban className="mr-1 h-3 w-3" />
                          Annulla TS
                        </Button>
                      </div>
                    )}
                    {f.stato_ts === "IN_TRASMISSIONE" && (
                      <div className="pt-2 flex justify-end border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs w-full text-amber-700 hover:text-amber-800"
                          onClick={() => onRipristina(f.id)}
                          disabled={isPending}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Sblocca per reinvio
                        </Button>
                      </div>
                    )}
                    {f.stato_ts === "ANNULLATA_TS" && (
                      <div className="pt-2 flex justify-end border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs w-full"
                          onClick={() => onRipristina(f.id)}
                          disabled={isPending}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Ripristina per reinvio
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Bar selezione batch flottante in basso */}
      {selectedFatture.length > 0 && (
        <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center px-4 w-full">
          <div className="pointer-events-auto flex w-full max-w-3xl shrink-0 flex-col gap-3 rounded-xl border border-primary/30 bg-card/95 p-4 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between animate-in fade-in slide-in-from-bottom-2">
            <div>
              <p className="text-sm font-semibold">
                {selectedFatture.length} {selectedFatture.length === 1 ? "fattura selezionata" : "fatture selezionate"} per l&apos;invio
              </p>
              <p className="text-xs text-muted-foreground">
                Totale importo onorari: {formatCurrency(selectedTotalImporto)}
                {invalidCfCount > 0 && (
                  <span className="text-destructive font-medium ml-2">
                    ({invalidCfCount} con Codice Fiscale errato)
                  </span>
                )}
                {invalidImportoCount > 0 && (
                  <span className="text-destructive font-medium ml-2">
                    ({invalidImportoCount} con importo non valido per TS)
                  </span>
                )}
                {futureDateCount > 0 && (
                  <span className="text-amber-600 font-medium ml-2">
                    ({futureDateCount} con incasso futuro)
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => lotti.setSelectedIds(new Set())}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Deseleziona tutte
              </Button>
              <Button
                onClick={onOpenConfirmBatch}
                disabled={
                  isPending ||
                  !hasSettings ||
                  invalidCfCount > 0 ||
                  invalidImportoCount > 0 ||
                  futureDateCount > 0
                }
              >
                <SendHorizontal className="mr-2 h-4 w-4" />
                Invia a Sistema TS ({selectedFatture.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
