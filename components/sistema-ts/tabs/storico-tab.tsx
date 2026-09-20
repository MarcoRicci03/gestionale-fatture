"use client";

import {
  Clock,
  Search,
  RotateCcw,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  RefreshCw,
  FileDown,
  ChevronUp,
  ChevronDown,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { SogeiErrorBadge } from "../sogei-error-item";
import type { FatturaInTrasmissioneItem } from "@/lib/data/sistema-ts";
import type { useSistemaTsStorico } from "../hooks/use-sistema-ts-storico";
import { formatCurrency, formatDate, type TrasmissioneItem, type CancelInvoiceData } from "../types";

export type StoricoTabProps = {
  trasmissioni: TrasmissioneItem[];
  isPending: boolean;
  syncingId: number | null;
  storico: ReturnType<typeof useSistemaTsStorico>;
  onSyncEsito: (trasmissioneId: number) => void;
  onDownloadPdf: (trasmissioneId: number) => void;
  onOpenReportCsv: (csvContent: string) => void;
  onOpenCancelModal: (data: CancelInvoiceData) => void;
  onRipristina: (id: number) => void;
};

export function renderFatturaEsitoBadge(esito: FatturaInTrasmissioneItem["esitoFattura"]) {
  switch (esito) {
    case "ACCOLTA":
      return (
        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-400">
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Accolta
        </span>
      );
    case "ACCOLTA_CON_WARNING":
      return (
        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Con segnalazioni
        </span>
      );
    case "SCARTATA":
      return (
        <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/20 dark:bg-destructive/20 dark:text-destructive">
          <XCircle className="mr-1 h-3.5 w-3.5" /> Scartata
        </span>
      );
    case "GIA_PRESENTE_TS":
      return (
        <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/30 dark:bg-amber-950/40 dark:text-amber-400">
          <AlertTriangle className="mr-1 h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" /> Già presente su TS
        </span>
      );
    case "IN_ELABORAZIONE":
    default:
      return (
        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-800 dark:text-gray-400">
          <Clock className="mr-1 h-3.5 w-3.5" /> In elaborazione
        </span>
      );
  }
}

export function StoricoTab({
  trasmissioni,
  isPending,
  syncingId,
  storico,
  onSyncEsito,
  onDownloadPdf,
  onOpenReportCsv,
  onOpenCancelModal,
  onRipristina,
}: StoricoTabProps) {
  const {
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
  } = storico;

  if (trasmissioni.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <Clock className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-medium text-foreground">Nessuna trasmissione effettuata</p>
        <p className="text-sm text-muted-foreground">
          I pacchetti inviati al Sistema TS appariranno qui con il relativo protocollo e ricevuta.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      {/* Barra Filtri e Ricerca Storico */}
      <div className="shrink-0 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-end">
          {/* Campo Ricerca */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="storicoSearch" className="text-xs font-medium">
              Cerca nello storico
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="storicoSearch"
                type="text"
                placeholder="Protocollo, n. fattura, CF, nome..."
                value={storicoSearch}
                onChange={(e) => setStoricoSearch(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>
          </div>

          {/* Filtro Esito */}
          <div className="space-y-1.5">
            <Label htmlFor="storicoStato" className="text-xs font-medium">
              Esito Trasmissione
            </Label>
            <select
              id="storicoStato"
              value={storicoStato}
              onChange={(e) => setStoricoStato(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ALL">Tutti gli esiti</option>
              <option value="2">Accolte (senza anomalie)</option>
              <option value="3">Accolte con segnalazioni</option>
              <option value="SCARTATE">Scartate (errori bloccanti)</option>
              <option value="0">In elaborazione</option>
            </select>
          </div>

          {/* Data Invio Da */}
          <div className="space-y-1.5">
            <Label htmlFor="storicoDateFrom" className="text-xs font-medium">
              Data invio da
            </Label>
            <Input
              id="storicoDateFrom"
              type="date"
              value={storicoDateFrom}
              onChange={(e) => setStoricoDateFrom(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Data Invio A + Reset */}
          <div className="space-y-1.5">
            <Label htmlFor="storicoDateTo" className="text-xs font-medium">
              Data invio a
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="storicoDateTo"
                type="date"
                value={storicoDateTo}
                onChange={(e) => setStoricoDateTo(e.target.value)}
                className="text-xs"
              />
              <Tooltip content="Reimposta filtri storico">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleResetStoricoFilters}
                  aria-label="Reimposta filtri storico"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>

        {hasActiveStoricoFilters && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
            <span>
              Mostrate <strong>{filteredTrasmissioni.length}</strong> di <strong>{trasmissioni.length}</strong> trasmissioni
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetStoricoFilters}
              className="h-6 text-xs text-muted-foreground hover:text-foreground"
            >
              Azzera filtri
            </Button>
          </div>
        )}
      </div>

      {filteredTrasmissioni.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center bg-muted/20">
          <Filter className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="font-medium text-foreground text-sm">Nessuna trasmissione trovata</p>
          <p className="text-xs text-muted-foreground mt-1">
            Nessun pacchetto corrisponde ai criteri di ricerca impostati.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetStoricoFilters}
            className="mt-3 text-xs"
          >
            Azzera filtri
          </Button>
        </div>
      ) : (
        <div className="flex-1 min-h-56 space-y-4 overflow-y-auto pr-1">
          {filteredTrasmissioni.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base font-mono flex items-center gap-2">
                      Protocollo: {t.protocollo}
                      {(t.tipo === "CANCELLAZIONE" || t.nomeFile.startsWith("annulla_")) && (
                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-sans font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10 dark:bg-purple-950/30 dark:text-purple-400">
                          Annullamento
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Inviato il {formatDate(t.dataInvio)} • {t.nomeFile} • {t.totaleFatture} documenti
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    {t.statoElaborazione === "0" && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        <Clock className="mr-1 h-3 w-3" /> In elaborazione
                      </span>
                    )}
                    {t.statoElaborazione === "2" && (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Accolto
                      </span>
                    )}
                    {t.statoElaborazione === "3" && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Accolto con segnalazioni
                      </span>
                    )}
                    {(t.statoElaborazione === "4" || t.statoElaborazione === "5") && (
                      <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                        <XCircle className="mr-1 h-3 w-3" /> Scartato
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="grid gap-2 sm:grid-cols-3 text-sm pt-2 border-t border-border">
                  <div>
                    <span className="text-xs text-muted-foreground">Documenti Ricevuti:</span>{" "}
                    <span className="font-medium">{t.numRicevuti ?? t.totaleFatture}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Documenti Accolti:</span>{" "}
                    <span className="font-medium text-emerald-600">{t.numAccolti ?? "-"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Documenti Scartati:</span>{" "}
                    <span className="font-medium text-destructive">{t.numScartati ?? 0}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <p className="text-xs text-muted-foreground">
                    {t.descrizioneEsito || "In attesa di verifica esito dal Sistema TS"}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    {t.hasCsvErrori && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenReportCsv(t.csvErrori || "")}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        Report Errori
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending && syncingId === t.id}
                      onClick={() => onSyncEsito(t.id)}
                    >
                      <RefreshCw
                        className={`mr-1.5 h-3.5 w-3.5 ${
                          isPending && syncingId === t.id ? "animate-spin" : ""
                        }`}
                      />
                      Verifica Esito
                    </Button>

                    {t.hasPdfRicevuta && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onDownloadPdf(t.id)}
                      >
                        <FileDown className="mr-1.5 h-3.5 w-3.5" />
                        Scarica Ricevuta PDF
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(t.id)}
                      className="text-xs"
                    >
                      {expandedTransmissions.has(t.id) ? (
                        <>
                          <ChevronUp className="mr-1 h-3.5 w-3.5" />
                          Nascondi fatture
                        </>
                      ) : (
                        <>
                          <ChevronDown className="mr-1 h-3.5 w-3.5" />
                          Dettaglio fatture ({t.fatture.length})
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Dettaglio fatture trasmesse (espandibile) */}
                {expandedTransmissions.has(t.id) && (
                  <div className="pt-3 border-t border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Dettaglio fatture trasmesse ({t.fatture.length})
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        {t.fatture.filter((f) => f.esitoFattura === "ACCOLTA" || f.esitoFattura === "ACCOLTA_CON_WARNING").length} accolte • {t.fatture.filter((f) => f.esitoFattura === "SCARTATA").length} scartate
                      </span>
                    </div>

                    {t.fatture.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        Nessun dettaglio fattura disponibile per questa trasmissione.
                      </p>
                    ) : (
                      <>
                        {/* Desktop Table (hidden md:block) */}
                        <div className="hidden md:block overflow-x-auto rounded-md border border-border bg-muted/20">
                          <Table className="w-full min-w-[850px]">
                            <TableHeader>
                              <TableRow className="text-xs">
                                <TableHead className="w-24 shrink-0">N. Fattura</TableHead>
                                <TableHead className="w-24 shrink-0">Data</TableHead>
                                <TableHead className="min-w-[130px]">Intestatario</TableHead>
                                <TableHead className="text-right w-20 shrink-0">Importo</TableHead>
                                <TableHead className="w-36 shrink-0">Esito Sogei</TableHead>
                                <TableHead className="min-w-[300px]">Segnalazioni / Note</TableHead>
                                <TableHead className="text-right w-32 shrink-0">Azioni</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {t.fatture.map((f) => (
                                <TableRow key={f.id} className="text-xs">
                                  <TableCell className="font-semibold align-top py-3 shrink-0">
                                    #{f.n_fattura}/{f.anno}
                                  </TableCell>
                                  <TableCell className="align-top py-3 shrink-0">{formatDate(f.data)}</TableCell>
                                  <TableCell className="align-top py-3">
                                    <div className="flex flex-col">
                                      <span className="font-medium">{f.paganteNome}</span>
                                      {f.paganteCf && (
                                        <span className="text-[11px] font-mono text-muted-foreground">
                                          {f.paganteCf}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-medium align-top py-3 shrink-0">
                                    {formatCurrency(f.prezzo_totale)}
                                  </TableCell>
                                  <TableCell className="align-top py-3 shrink-0">
                                    <div className="flex flex-col gap-1 items-start">
                                      {renderFatturaEsitoBadge(f.esitoFattura)}
                                      {f.stato_ts === "DA_INVIARE" && (
                                        <span className="text-[10px] font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                                          Pronta per reinvio
                                        </span>
                                      )}
                                      {f.stato_ts === "ANNULLATA_TS" && (
                                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                          Annullata su TS
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="whitespace-normal align-top py-3 min-w-[240px] max-w-xl">
                                    {f.errori.length > 0 ? (
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {f.errori.map((err, idx) => (
                                          <SogeiErrorBadge key={idx} error={err} />
                                        ))}
                                      </div>
                                    ) : f.esitoFattura === "ACCOLTA" ? (
                                      <span className="text-muted-foreground text-[11px]">Nessuna anomalia</span>
                                    ) : (
                                      <span className="text-muted-foreground text-[11px]">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right whitespace-nowrap align-top py-3 w-32 shrink-0">
                                    {f.stato_ts === "DA_INVIARE" ? (
                                      <span className="text-[11px] text-muted-foreground">In &ldquo;Da Inviare&rdquo;</span>
                                    ) : f.esitoFattura === "GIA_PRESENTE_TS" ? (
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
                                            paganteNome: f.paganteNome,
                                          })
                                        }
                                        disabled={isPending}
                                      >
                                        <Ban className="mr-1 h-3 w-3" />
                                        Annulla TS
                                      </Button>
                                    ) : f.stato_ts === "ANNULLATA_TS" ? (
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
                                    ) : (f.esitoFattura === "ACCOLTA" || f.esitoFattura === "ACCOLTA_CON_WARNING") ? (
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
                                            paganteNome: f.paganteNome,
                                          })
                                        }
                                        disabled={isPending}
                                      >
                                        <Ban className="mr-1 h-3 w-3" />
                                        Annulla TS
                                      </Button>
                                    ) : null}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Mobile Cards (md:hidden) */}
                        <div className="md:hidden space-y-2">
                          {t.fatture.map((f) => (
                            <div
                              key={f.id}
                              className="rounded-md border border-border p-3 space-y-2 bg-muted/20 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold">
                                  Fattura #{f.n_fattura}/{f.anno}
                                </span>
                                <span className="font-semibold">
                                  {formatCurrency(f.prezzo_totale)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>{f.paganteNome}</span>
                                <span>{formatDate(f.data)}</span>
                              </div>
                              <div className="pt-1 flex items-center justify-between border-t border-border">
                                <span className="text-muted-foreground">Esito:</span>
                                <div className="flex items-center gap-1.5">
                                  {renderFatturaEsitoBadge(f.esitoFattura)}
                                  {f.stato_ts === "DA_INVIARE" && (
                                    <span className="text-[10px] font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                                      Pronta
                                    </span>
                                  )}
                                  {f.stato_ts === "ANNULLATA_TS" && (
                                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                      Annullata
                                    </span>
                                  )}
                                </div>
                              </div>
                              {f.errori.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border">
                                  {f.errori.map((err, idx) => (
                                    <SogeiErrorBadge key={idx} error={err} />
                                  ))}
                                </div>
                              )}
                              <div className="pt-2 flex justify-end border-t border-border">
                                {f.stato_ts === "DA_INVIARE" ? (
                                  <span className="text-[11px] text-muted-foreground">In &ldquo;Da Inviare&rdquo;</span>
                                ) : f.esitoFattura === "GIA_PRESENTE_TS" ? (
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
                                        paganteNome: f.paganteNome,
                                      })
                                    }
                                    disabled={isPending}
                                  >
                                    <Ban className="mr-1 h-3 w-3" />
                                    Annulla su Sistema TS
                                  </Button>
                                ) : f.stato_ts === "ANNULLATA_TS" ? (
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
                                ) : (f.esitoFattura === "ACCOLTA" || f.esitoFattura === "ACCOLTA_CON_WARNING") ? (
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
                                        paganteNome: f.paganteNome,
                                      })
                                    }
                                    disabled={isPending}
                                  >
                                    <Ban className="mr-1 h-3 w-3" />
                                    Annulla su Sistema TS
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
