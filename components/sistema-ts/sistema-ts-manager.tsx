"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  SendHorizontal,
  RefreshCw,
  FileDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertCircle,
  FileText,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Ban,
  Search,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import {
  inviaLottoFatture,
  sincronizzaEsitoTrasmissione,
  getRicevutaPdfBase64,
  annullaFatturaTs,
  ripristinaFatturaPerReinvio,
} from "@/lib/actions/sistema-ts";
import { maskDateInput } from "@/lib/utils/date";
import type { FatturaTsListItem, FatturaInTrasmissioneItem } from "@/lib/data/sistema-ts";

type TrasmissioneItem = {
  id: number;
  tipo?: string;
  protocollo: string;
  nomeFile: string;
  dataInvio: Date;
  statoElaborazione: string | null;
  codiceEsito: string | null;
  descrizioneEsito: string | null;
  numRicevuti: number | null;
  numAccolti: number | null;
  numScartati: number | null;
  hasPdfRicevuta: boolean;
  hasCsvErrori: boolean;
  csvErrori?: string | null;
  totaleFatture: number;
  fatture: FatturaInTrasmissioneItem[];
};

type SistemaTsManagerProps = {
  fatture: FatturaTsListItem[];
  trasmissioni: TrasmissioneItem[];
  hasSettings: boolean;
  filters: {
    dateFrom?: string;
    dateTo?: string;
    stato?: string;
  };
};

function renderFatturaEsitoBadge(esito: FatturaInTrasmissioneItem["esitoFattura"]) {
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

function formatCurrency(val: number) {
  return val.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function SistemaTsManager({
  fatture,
  trasmissioni,
  hasSettings,
  filters,
}: SistemaTsManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"lotti" | "storico">("lotti");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(filters.dateTo ?? "");
  const [statoFilter, setStatoFilter] = useState(filters.stato ?? "DA_INVIARE");

  const [isPending, startTransition] = useTransition();
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [selectedReportCsv, setSelectedReportCsv] = useState<string | null>(null);
  const [cancellingInvoice, setCancellingInvoice] = useState<{
    id: number;
    n_fattura: number;
    anno: number;
    data: Date;
    paganteNome: string;
  } | null>(null);
  const [cancelConfirmNumero, setCancelConfirmNumero] = useState("");
  const [cancelConfirmData, setCancelConfirmData] = useState("");
  const [cancelConfirmIntestatario, setCancelConfirmIntestatario] = useState("");

  const handleOpenCancelModal = (inv: {
    id: number;
    n_fattura: number;
    anno: number;
    data: Date;
    paganteNome: string;
  }) => {
    setCancelConfirmNumero("");
    setCancelConfirmData("");
    setCancelConfirmIntestatario("");
    setCancellingInvoice(inv);
  };

  const handleCloseCancelModal = () => {
    setCancellingInvoice(null);
    setCancelConfirmNumero("");
    setCancelConfirmData("");
    setCancelConfirmIntestatario("");
  };

  const isCancelNumeroValid = useMemo(() => {
    if (!cancellingInvoice) return false;
    const clean = cancelConfirmNumero.trim().replace(/^#/, "").trim();
    if (!clean) return false;
    return (
      clean === String(cancellingInvoice.n_fattura) ||
      clean === `${cancellingInvoice.n_fattura}/${cancellingInvoice.anno}` ||
      clean === `${cancellingInvoice.n_fattura}-${cancellingInvoice.anno}`
    );
  }, [cancellingInvoice, cancelConfirmNumero]);

  const isCancelDataValid = useMemo(() => {
    if (!cancellingInvoice) return false;
    const trimmed = cancelConfirmData.trim();
    if (!trimmed) return false;

    const formattedExpected = formatDate(cancellingInvoice.data);
    if (trimmed === formattedExpected) return true;

    const [expDayStr, expMonthStr, expYearStr] = formattedExpected.split("/");
    const expDay = parseInt(expDayStr, 10);
    const expMonth = parseInt(expMonthStr, 10);
    const expYear = parseInt(expYearStr, 10);

    const dmy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) {
      const d = parseInt(dmy[1], 10);
      const m = parseInt(dmy[2], 10);
      const y = parseInt(dmy[3], 10);
      if (d === expDay && m === expMonth && y === expYear) return true;
    }

    const ymd = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (ymd) {
      const y = parseInt(ymd[1], 10);
      const m = parseInt(ymd[2], 10);
      const d = parseInt(ymd[3], 10);
      if (d === expDay && m === expMonth && y === expYear) return true;
    }

    return false;
  }, [cancellingInvoice, cancelConfirmData]);

  const isCancelIntestatarioValid = useMemo(() => {
    if (!cancellingInvoice) return false;
    const clean = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const inputWords = clean(cancelConfirmIntestatario);
    const targetWords = clean(cancellingInvoice.paganteNome);

    if (inputWords.length === 0 || targetWords.length === 0) return false;
    if (inputWords.length !== targetWords.length) return false;

    const sortedInput = [...inputWords].sort().join(" ");
    const sortedTarget = [...targetWords].sort().join(" ");
    return sortedInput === sortedTarget;
  }, [cancellingInvoice, cancelConfirmIntestatario]);

  const isCancelConfirmationValid =
    isCancelNumeroValid && isCancelDataValid && isCancelIntestatarioValid;

  // Dettaglio fatture chiuso di default per ogni trasmissione
  const [expandedTransmissions, setExpandedTransmissions] = useState<Set<number>>(new Set());

  // Filtri e ricerca per il tab Storico Trasmissioni
  const [storicoSearch, setStoricoSearch] = useState("");
  const [storicoStato, setStoricoStato] = useState("ALL");
  const [storicoDateFrom, setStoricoDateFrom] = useState("");
  const [storicoDateTo, setStoricoDateTo] = useState("");

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

  const toggleExpanded = (id: number) => {
    setExpandedTransmissions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtra selezionabili per lotto invio: solo DA_INVIARE
  const selectableFatture = useMemo(
    () => fatture.filter((f) => f.stato_ts === "DA_INVIARE"),
    [fatture]
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
    router.push("/sistema-ts?stato=DA_INVIARE");
  };

  const handleSendBatch = () => {
    if (selectedIds.size === 0) return;
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const result = await inviaLottoFatture(Array.from(selectedIds));
      setConfirmModalOpen(false);
      if ("error" in result) {
        setActionError(result.error);
        return;
      }
      setActionSuccess(
        `Lotto inviato con successo! Assegnato Protocollo MEF: ${result.protocollo}`
      );
      setSelectedIds(new Set());
      router.refresh();
    });
  };

  const handleSyncEsito = (trasmissioneId: number) => {
    setActionError(null);
    setActionSuccess(null);
    setSyncingId(trasmissioneId);

    startTransition(async () => {
      const result = await sincronizzaEsitoTrasmissione(trasmissioneId);
      setSyncingId(null);
      if ("error" in result) {
        setActionError(result.error);
        return;
      }
      setActionSuccess(result.message || "Esito sincronizzato con successo.");
      router.refresh();
    });
  };

  const handleDownloadPdf = async (trasmissioneId: number) => {
    setActionError(null);
    const res = await getRicevutaPdfBase64(trasmissioneId);
    if ("error" in res) {
      setActionError(res.error);
      return;
    }

    const binaryString = window.atob(res.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRipristina = (invoiceId: number) => {
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await ripristinaFatturaPerReinvio(invoiceId);
      if ("error" in res) {
        setActionError(res.error);
        return;
      }
      setActionSuccess(res.message || "Fattura ripristinata con successo su 'Da Inviare'.");
      router.refresh();
    });
  };

  const handleAnnullaTs = (invoiceId: number) => {
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await annullaFatturaTs(invoiceId);
      handleCloseCancelModal();
      if ("error" in res) {
        setActionError(res.error);
        return;
      }
      setActionSuccess(res.message || "Fattura annullata con successo su Sistema TS.");
      router.refresh();
    });
  };

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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-6">
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sistema Tessera Sanitaria</h1>
          <p className="text-muted-foreground">
            Trasmissione telematica delle spese sanitarie al MEF per il 730 precompilato (v2.5).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!hasSettings ? (
            <Link
              href="/settings/sistema-ts"
              className={buttonVariants({ variant: "destructive" })}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Configura Credenziali TS
            </Link>
          ) : (
            <Link
              href="/settings/sistema-ts"
              className={buttonVariants({ variant: "outline" })}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Impostazioni TS
            </Link>
          )}
        </div>
      </div>

      {!hasSettings && (
        <div className="flex shrink-0 items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>
            Non hai ancora configurato le credenziali del Sistema TS. Vai in{" "}
            <Link href="/settings/sistema-ts" className="underline font-semibold">
              Impostazioni Sistema TS
            </Link>{" "}
            per inserire Username, Password e PinCode prima di effettuare invii.
          </p>
        </div>
      )}

      {actionError && (
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400" role="status">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {isPending && (
        <div className="flex shrink-0 items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary animate-pulse" role="status">
          <RefreshCw className="h-5 w-5 shrink-0 animate-spin" />
          <div>
            <p className="font-semibold">Comunicazione con i server del Sistema TS (Sogei) in corso...</p>
            <p className="text-xs text-muted-foreground">
              La cifratura dei codici fiscali e l&apos;invio telematico SOAP MTOM possono richiedere alcuni secondi.
            </p>
          </div>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex shrink-0 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("lotti")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "lotti"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <SendHorizontal className="h-4 w-4" />
          Fatture da Inviare / Lotti ({fatture.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("storico")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "storico"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" />
          Storico Trasmissioni (
          {hasActiveStoricoFilters
            ? `${filteredTrasmissioni.length}/${trasmissioni.length}`
            : trasmissioni.length}
          )
        </button>
      </div>

      {activeTab === "lotti" && (
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
                <Button variant="outline" onClick={handleResetFilters}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Action Bar selezione batch */}
          {selectedIds.size > 0 && (
            <div className="flex shrink-0 flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {selectedIds.size} {selectedIds.size === 1 ? "fattura selezionata" : "fatture selezionate"} per l&apos;invio
                </p>
                <p className="text-xs text-muted-foreground">
                  Totale importo onorari: {formatCurrency(selectedTotalImporto)}
                  {invalidCfCount > 0 && (
                    <span className="text-destructive font-medium ml-2">
                      ({invalidCfCount} con Codice Fiscale errato)
                    </span>
                  )}
                </p>
              </div>

              <Button
                onClick={() => setConfirmModalOpen(true)}
                disabled={isPending || !hasSettings || invalidCfCount > 0}
              >
                <SendHorizontal className="mr-2 h-4 w-4" />
                Invia a Sistema TS ({selectedIds.size})
              </Button>
            </div>
          )}

          {fatture.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">Nessuna fattura trovata</p>
              <p className="text-sm text-muted-foreground">
                Non ci sono fatture corrispondenti ai filtri impostati.
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
                          className="h-4 w-4 rounded border-gray-300"
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
                    {fatture.map((f) => {
                      const isSelectable = f.stato_ts === "DA_INVIARE";
                      const isSelected = selectedIds.has(f.id);

                      return (
                        <TableRow key={f.id} className={isSelected ? "bg-primary/5" : undefined}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!isSelectable}
                              onChange={() => toggleSelect(f.id)}
                              className="h-4 w-4 rounded border-gray-300"
                              aria-label={`Seleziona fattura ${f.n_fattura}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {f.n_fattura}/{f.anno}
                          </TableCell>
                          <TableCell>{formatDate(f.data)}</TableCell>
                          <TableCell>{f.paganteNomeCompleto}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs">{f.paganteCf || "Mancante"}</span>
                              {f.cfValido ? (
                                <Tooltip content="Codice Fiscale formalmente valido (CIN corretto)">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                </Tooltip>
                              ) : (
                                <Tooltip content={f.cfErrore || "Codice Fiscale non valido"}>
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(f.prezzo_totale)}
                          </TableCell>
                          <TableCell>
                            {f.richiedeBollo ? (
                              <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-400">
                                2,00 € {f.bolloMancante && "(senza codice)"}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs font-medium ${f.pagamento_tracciato ? "text-emerald-600" : "text-amber-600"}`}>
                              {f.pagamento_tracciato ? "SI" : "NO"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {f.stato_ts === "IN_TRASMISSIONE" && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-400">
                                <RefreshCw className="h-3 w-3 animate-spin" /> In trasmissione
                              </span>
                            )}
                            {f.stato_ts === "DA_INVIARE" && (
                              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-950/30 dark:text-blue-400">
                                Da inviare
                              </span>
                            )}
                            {f.stato_ts === "INVIATA" && (
                              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-400">
                                Inviata
                              </span>
                            )}
                            {f.stato_ts === "DA_CANCELLARE_SU_TS" && (
                              <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-400">
                                {f.protocollo_cancellazione_ts ? "Canc. in corso" : "Da cancellare"}
                              </span>
                            )}
                            {f.stato_ts === "ANNULLATA_TS" && (
                              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                Annullata TS
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {f.stato_ts === "INVIATA" || f.stato_ts === "DA_CANCELLARE_SU_TS" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() =>
                                  handleOpenCancelModal({
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
                            ) : f.stato_ts === "IN_TRASMISSIONE" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-amber-700 hover:text-amber-800"
                                onClick={() => handleRipristina(f.id)}
                                disabled={isPending}
                                title="Sblocca e riporta a Da Inviare se la trasmissione è rimasta interrotta"
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Sblocca
                              </Button>
                            ) : f.stato_ts === "ANNULLATA_TS" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleRipristina(f.id)}
                                disabled={isPending}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Ripristina
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Vista Mobile Cards (lg:hidden) per AGENTS.md */}
              <div className="flex-1 min-h-56 space-y-3 overflow-y-auto lg:hidden">
                {fatture.map((f) => {
                  const isSelectable = f.stato_ts === "DA_INVIARE";
                  const isSelected = selectedIds.has(f.id);

                  return (
                    <Card key={f.id} className={isSelected ? "border-primary" : undefined}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!isSelectable}
                              onChange={() => toggleSelect(f.id)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                            <span className="font-bold">
                              Fattura #{f.n_fattura}/{f.anno}
                            </span>
                          </div>
                          <span className="text-sm font-semibold">
                            {formatCurrency(f.prezzo_totale)}
                          </span>
                        </div>

                        <div className="text-sm">
                          <p className="text-muted-foreground text-xs">Intestatario</p>
                          <p className="font-medium">{f.paganteNomeCompleto}</p>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono">{f.paganteCf}</span>
                            {f.cfValido ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                            )}
                          </div>
                          <div>
                            {f.stato_ts === "IN_TRASMISSIONE" && (
                              <span className="text-amber-600 font-medium inline-flex items-center gap-1">
                                <RefreshCw className="h-3 w-3 animate-spin" /> In trasmissione
                              </span>
                            )}
                            {f.stato_ts === "DA_INVIARE" && (
                              <span className="text-blue-600 font-medium">Da inviare</span>
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

                        {(f.stato_ts === "INVIATA" || f.stato_ts === "DA_CANCELLARE_SU_TS") && (
                          <div className="pt-2 flex justify-end border-t border-border">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() =>
                                handleOpenCancelModal({
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
                              onClick={() => handleRipristina(f.id)}
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
                              onClick={() => handleRipristina(f.id)}
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
        </div>
      )}

      {activeTab === "storico" && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {trasmissioni.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <Clock className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">Nessuna trasmissione effettuata</p>
              <p className="text-sm text-muted-foreground">
                I pacchetti inviati al Sistema TS appariranno qui con il relativo protocollo e ricevuta.
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
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
                            onClick={() => setSelectedReportCsv(t.csvErrori || "")}
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
                          onClick={() => handleSyncEsito(t.id)}
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
                            onClick={() => handleDownloadPdf(t.id)}
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
                            <div className="hidden md:block rounded-md border border-border bg-muted/20">
                              <Table>
                                <TableHeader>
                                  <TableRow className="text-xs">
                                    <TableHead className="w-24">N. Fattura</TableHead>
                                    <TableHead className="w-28">Data</TableHead>
                                    <TableHead>Intestatario</TableHead>
                                    <TableHead className="text-right w-24">Importo</TableHead>
                                    <TableHead className="w-48">Esito Sogei</TableHead>
                                    <TableHead>Segnalazioni / Note</TableHead>
                                    <TableHead className="text-right w-36">Azioni</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {t.fatture.map((f) => (
                                    <TableRow key={f.id} className="text-xs">
                                      <TableCell className="font-semibold">
                                        #{f.n_fattura}/{f.anno}
                                      </TableCell>
                                      <TableCell>{formatDate(f.data)}</TableCell>
                                      <TableCell>
                                        <div className="flex flex-col">
                                          <span className="font-medium">{f.paganteNome}</span>
                                          {f.paganteCf && (
                                            <span className="text-[11px] font-mono text-muted-foreground">
                                              {f.paganteCf}
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        {formatCurrency(f.prezzo_totale)}
                                      </TableCell>
                                      <TableCell>
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
                                      <TableCell>
                                        {f.errori.length > 0 ? (
                                          <div className="space-y-1">
                                            {f.errori.map((err, idx) =>
                                              err.codiceErrore === "S017" ? (
                                                <div
                                                  key={idx}
                                                  className="rounded bg-amber-500/10 p-2 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 leading-tight space-y-0.5"
                                                >
                                                  <div className="font-bold flex items-center gap-1 text-amber-700 dark:text-amber-400">
                                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                                    [S017] Già presente nel Sistema TS
                                                  </div>
                                                  <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90">
                                                    Questa fattura risultava già acquisita nei server ministeriali del MEF (non inviata da questa sessione). Non occorre reinviarla.
                                                  </p>
                                                </div>
                                              ) : (
                                                <div
                                                  key={idx}
                                                  className={`text-[11px] leading-tight flex items-start gap-1 ${
                                                    err.tipo === "ERRORE"
                                                      ? "text-destructive font-medium"
                                                      : "text-amber-700 dark:text-amber-400"
                                                  }`}
                                                >
                                                  <span className="font-mono font-bold shrink-0">[{err.codiceErrore}]</span>
                                                  <span>{err.descrizione}</span>
                                                </div>
                                              )
                                            )}
                                          </div>
                                        ) : f.esitoFattura === "ACCOLTA" ? (
                                          <span className="text-muted-foreground text-[11px]">Nessuna anomalia</span>
                                        ) : (
                                          <span className="text-muted-foreground text-[11px]">-</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {f.stato_ts === "DA_INVIARE" ? (
                                          <span className="text-[11px] text-muted-foreground">In &ldquo;Da Inviare&rdquo;</span>
                                        ) : f.esitoFattura === "GIA_PRESENTE_TS" ? (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() =>
                                              handleOpenCancelModal({
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
                                            onClick={() => handleRipristina(f.id)}
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
                                              handleOpenCancelModal({
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
                                    <div className="space-y-1 pt-1 border-t border-border">
                                      {f.errori.map((err, idx) =>
                                        err.codiceErrore === "S017" ? (
                                          <div
                                            key={idx}
                                            className="rounded bg-amber-500/10 p-2 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 leading-tight space-y-0.5"
                                          >
                                            <div className="font-bold flex items-center gap-1 text-amber-700 dark:text-amber-400">
                                              <AlertTriangle className="h-3 w-3 shrink-0" />
                                              [S017] Già presente nel Sistema TS
                                            </div>
                                            <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90">
                                              Questa fattura risultava già acquisita nei server ministeriali del MEF (non inviata da questa sessione). Non occorre reinviarla.
                                            </p>
                                          </div>
                                        ) : (
                                          <div
                                            key={idx}
                                            className={`text-[11px] leading-tight flex items-start gap-1 ${
                                              err.tipo === "ERRORE"
                                                ? "text-destructive font-medium"
                                                : "text-amber-700 dark:text-amber-400"
                                            }`}
                                          >
                                            <span className="font-mono font-bold shrink-0">[{err.codiceErrore}]</span>
                                            <span>{err.descrizione}</span>
                                          </div>
                                        )
                                      )}
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
                                          handleOpenCancelModal({
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
                                        onClick={() => handleRipristina(f.id)}
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
                                          handleOpenCancelModal({
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
        )}
      </div>
    )}

      {/* Confirmation Modal */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Conferma invio a Sistema TS</DialogTitle>
            <DialogDescription>
              Stai per trasmettere telematicamente {selectedIds.size} documenti di spesa al
              Sistema Tessera Sanitaria (Sogei / MEF).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="rounded-lg bg-muted p-3 space-y-1 text-xs">
              <p>• Totale fatture selezionate: <strong>{selectedIds.size}</strong></p>
              <p>• Totale onorari: <strong>{formatCurrency(selectedTotalImporto)}</strong></p>
              <p>• Verrà generato un archivio ZIP conforme allo schema <strong>v2.5</strong></p>
              <p>• I Codici Fiscali e il PinCode saranno cifrati con chiave pubblica RSA ministeriale</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Una volta inviate, le fatture riceveranno un numero di protocollo ufficiale e
              non potranno essere cancellate se non tramite richiesta telematica di annullamento.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmModalOpen(false)}
              disabled={isPending}
            >
              Annulla
            </Button>
            <Button onClick={handleSendBatch} disabled={isPending}>
              {isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Trasmissione a Sogei in corso...
                </>
              ) : (
                "Conferma e Invia"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Report Anomalie CSV */}
      <Dialog
        open={!!selectedReportCsv}
        onOpenChange={(open) => !open && setSelectedReportCsv(null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-destructive" />
              Report Errori e Segnalazioni Sogei (CSV)
            </DialogTitle>
            <DialogDescription>
              Dettaglio anomalie restituito dal servizio ministeriale DettaglioErrori730Service per questa trasmissione.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto rounded border border-border bg-muted/40 p-3 my-2">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
              {selectedReportCsv}
            </pre>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!selectedReportCsv) return;
                const blob = new Blob([selectedReportCsv], {
                  type: "text/csv;charset=utf-8;",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "report_errori_sistemats.csv";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
            >
              <FileDown className="mr-1.5 h-3.5 w-3.5" />
              Scarica File CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedReportCsv(null)}
            >
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Conferma Annullamento su Sistema TS */}
      <Dialog
        open={!!cancellingInvoice}
        onOpenChange={(open) => !open && handleCloseCancelModal()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Annullamento Spesa su Sistema TS
            </DialogTitle>
            <DialogDescription>
              Stai per inviare una richiesta ufficiale di cancellazione (operazione &apos;C&apos;)
              per la fattura #{cancellingInvoice?.n_fattura}/{cancellingInvoice?.anno} ai server di Sogei / MEF.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="rounded-lg bg-destructive/10 p-3 text-destructive border border-destructive/20 space-y-1">
              <p className="font-semibold">Cosa comporta questa operazione:</p>
              <p>• La spesa sanitaria verrà <strong>eliminata dal 730 precompilato</strong> dell&apos;assistito.</p>
              <p>• Verrà rilasciato da Sogei un Protocollo di Cancellazione ufficiale.</p>
              <p>• La fattura rimarrà nel gestionale con stato &ldquo;Annullata su TS&rdquo;.</p>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
              <p className="font-medium text-foreground text-xs">
                Per confermare ed evitare cancellazioni accidentali, digita i seguenti dati di verifica della fattura:
              </p>

              {/* Numero fattura */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cancel-numero" className="text-xs">
                    Numero fattura
                  </Label>
                  {cancelConfirmNumero.trim() && (
                    isCancelNumeroValid ? (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Corretto
                      </span>
                    ) : (
                      <span className="text-[11px] text-destructive flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Non corrisponde
                      </span>
                    )
                  )}
                </div>
                <Input
                  id="cancel-numero"
                  value={cancelConfirmNumero}
                  onChange={(e) => setCancelConfirmNumero(e.target.value)}
                  placeholder={cancellingInvoice ? String(cancellingInvoice.n_fattura) : ""}
                  className="h-8 text-xs bg-background"
                  disabled={isPending}
                />
              </div>

              {/* Data emissione */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cancel-data" className="text-xs">
                    Data emissione <span className="text-muted-foreground font-normal">(GG/MM/AAAA)</span>
                  </Label>
                  {cancelConfirmData.trim() && (
                    isCancelDataValid ? (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Corretto
                      </span>
                    ) : (
                      <span className="text-[11px] text-destructive flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Non corrisponde
                      </span>
                    )
                  )}
                </div>
                <Input
                  id="cancel-data"
                  value={cancelConfirmData}
                  onChange={(e) =>
                    setCancelConfirmData(
                      maskDateInput(e.target.value, cancelConfirmData)
                    )
                  }
                  placeholder={cancellingInvoice ? formatDate(cancellingInvoice.data) : "GG/MM/AAAA"}
                  maxLength={10}
                  className="h-8 text-xs bg-background"
                  disabled={isPending}
                />
              </div>

              {/* Intestatario */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cancel-intestatario" className="text-xs">
                    Intestatario fattura <span className="text-muted-foreground font-normal">(nome e cognome)</span>
                  </Label>
                  {cancelConfirmIntestatario.trim() && (
                    isCancelIntestatarioValid ? (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Corretto
                      </span>
                    ) : (
                      <span className="text-[11px] text-destructive flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Non corrisponde
                      </span>
                    )
                  )}
                </div>
                <Input
                  id="cancel-intestatario"
                  value={cancelConfirmIntestatario}
                  onChange={(e) => setCancelConfirmIntestatario(e.target.value)}
                  placeholder={cancellingInvoice?.paganteNome ?? ""}
                  className="h-8 text-xs bg-background"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseCancelModal}
              disabled={isPending}
            >
              Indietro
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (cancellingInvoice && isCancelConfirmationValid) {
                  handleAnnullaTs(cancellingInvoice.id);
                }
              }}
              disabled={isPending || !isCancelConfirmationValid}
            >
              {isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Cancellazione in corso...
                </>
              ) : (
                "Conferma Cancellazione"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
