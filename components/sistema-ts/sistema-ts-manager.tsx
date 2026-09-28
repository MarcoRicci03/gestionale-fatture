"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  SendHorizontal,
  RefreshCw,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  inviaLottoFatture,
  sincronizzaEsitoTrasmissione,
  annullaFatturaTs,
  ripristinaFatturaPerReinvio,
} from "@/lib/actions/sistema-ts";
import { FixInvoiceTsDialog } from "./fix-invoice-ts-dialog";
import { LottiTab } from "./tabs/lotti-tab";
import { StoricoTab } from "./tabs/storico-tab";
import { BatchConfirmDialog } from "./dialogs/batch-confirm-dialog";
import { CancelInvoiceTsDialog } from "./dialogs/cancel-invoice-ts-dialog";
import { VerificaEsitoDialog } from "./dialogs/verifica-esito-dialog";
import { CsvReportDialog } from "./dialogs/csv-report-dialog";
import { useSistemaTsLotti } from "./hooks/use-sistema-ts-lotti";
import { useSistemaTsStorico } from "./hooks/use-sistema-ts-storico";
import type { FatturaTsListItem } from "@/lib/data/sistema-ts";
import type { TrasmissioneItem, CancelInvoiceData } from "./types";

export type { TrasmissioneItem, CancelInvoiceData };

export type SistemaTsManagerProps = {
  fatture: FatturaTsListItem[];
  trasmissioni: TrasmissioneItem[];
  hasSettings: boolean;
  filters: {
    dateFrom?: string;
    dateTo?: string;
    stato?: string;
  };
};

export function SistemaTsManager({
  fatture,
  trasmissioni,
  hasSettings,
  filters,
}: SistemaTsManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"lotti" | "storico">("lotti");
  const [isPending, startTransition] = useTransition();
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modali
  const [fixingInvoice, setFixingInvoice] = useState<FatturaTsListItem | null>(null);
  const [selectedReportCsv, setSelectedReportCsv] = useState<string | null>(null);
  const [cancellingInvoice, setCancellingInvoice] = useState<CancelInvoiceData | null>(null);
  const [verificaInvoice, setVerificaInvoice] = useState<FatturaTsListItem | null>(null);

  // Hooks specializzati per la gestione dello stato dei due tab
  const lotti = useSistemaTsLotti({ fatture, initialFilters: filters });
  const storico = useSistemaTsStorico({ trasmissioni });

  useEffect(() => {
    if (!actionSuccess) return;
    const timer = setTimeout(() => setActionSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [actionSuccess]);

  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => setActionError(null), 5000);
    return () => clearTimeout(timer);
  }, [actionError]);

  const otherDraftsCount = useMemo(() => {
    if (!fixingInvoice || !fixingInvoice.id_Pagante) return 0;
    return fatture.filter(
      (f) =>
        f.id !== fixingInvoice.id &&
        f.id_Pagante === fixingInvoice.id_Pagante &&
        f.stato_ts === "DA_INVIARE"
    ).length;
  }, [fixingInvoice, fatture]);

  const handleSendBatch = () => {
    const idsToSend = lotti.selectedFatture.map((f) => f.id);
    if (idsToSend.length === 0) return;
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const result = await inviaLottoFatture(idsToSend);
      setConfirmModalOpen(false);
      if ("error" in result) {
        setActionError(result.error);
        return;
      }
      setActionSuccess(
        `Lotto inviato con successo! Assegnato Protocollo MEF: ${result.protocollo}`
      );
      lotti.setSelectedIds(new Set());
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

  const handleRipristina = (invoiceId: number, confermaEsitoVerificato = false) => {
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await ripristinaFatturaPerReinvio(
        invoiceId,
        confermaEsitoVerificato ? { confermaEsitoVerificato: true } : undefined
      );
      setVerificaInvoice(null);
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
      setCancellingInvoice(null);
      if ("error" in res) {
        setActionError(res.error);
        return;
      }
      setActionSuccess(res.message || "Fattura annullata con successo su Sistema TS.");
      router.refresh();
    });
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-6">
      {/* Intestazione pagina */}
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

      {/* Avviso Credenziali non Configurate */}
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

      {/* Toast notifica in alto a destra */}
      {actionError && (
        <div
          role="alert"
          className={cn(
            "fixed right-4 top-4 z-50 flex max-w-md items-center gap-2.5 rounded-lg px-4 py-3 text-sm shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-top-2",
            "border border-destructive/30 bg-destructive text-destructive-foreground"
          )}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1 font-medium">{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="ml-2 -mr-1 rounded-md p-1 opacity-80 transition-opacity hover:opacity-100 hover:bg-white/10"
            aria-label="Chiudi notifica"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div
          role="status"
          className={cn(
            "fixed right-4 top-4 z-50 flex max-w-md items-center gap-2.5 rounded-lg px-4 py-3 text-sm shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-top-2",
            "bg-emerald-600 text-white dark:bg-emerald-700"
          )}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
          <span className="flex-1 font-medium">{actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="ml-2 -mr-1 rounded-md p-1 opacity-80 transition-opacity hover:opacity-100 hover:bg-white/10"
            aria-label="Chiudi notifica"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      )}

      {/* Banner di caricamento per chiamate SOAP Sogei */}
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
          {storico.hasActiveStoricoFilters
            ? `${storico.filteredTrasmissioni.length}/${trasmissioni.length}`
            : trasmissioni.length}
          )
        </button>
      </div>

      {/* Contenuto Tab Attivo */}
      {activeTab === "lotti" && (
        <LottiTab
          hasSettings={hasSettings}
          isPending={isPending}
          lotti={lotti}
          onOpenConfirmBatch={() => setConfirmModalOpen(true)}
          onFixInvoice={(invoice) => setFixingInvoice(invoice)}
          onOpenCancelModal={(data) => setCancellingInvoice(data)}
          onRipristina={(id) => handleRipristina(id)}
          onVerificaEsito={(invoice) => setVerificaInvoice(invoice)}
        />
      )}

      {activeTab === "storico" && (
        <StoricoTab
          trasmissioni={trasmissioni}
          isPending={isPending}
          syncingId={syncingId}
          storico={storico}
          onSyncEsito={handleSyncEsito}
          onOpenReportCsv={(csv) => setSelectedReportCsv(csv)}
          onOpenCancelModal={(data) => setCancellingInvoice(data)}
          onRipristina={handleRipristina}
        />
      )}

      {/* Modale Conferma Invio Batch */}
      <BatchConfirmDialog
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        selectedFattureCount={lotti.selectedFatture.length}
        selectedTotalImporto={lotti.selectedTotalImporto}
        isPending={isPending}
        onConfirm={handleSendBatch}
      />

      {/* Modale Report Errori CSV */}
      <CsvReportDialog
        csvContent={selectedReportCsv}
        onClose={() => setSelectedReportCsv(null)}
      />

      {/* Modale Conferma Annullamento TS con Verifica a 3 Campi */}
      <CancelInvoiceTsDialog
        cancellingInvoice={cancellingInvoice}
        onClose={() => setCancellingInvoice(null)}
        onConfirm={handleAnnullaTs}
        isPending={isPending}
      />

      {/* Modale Verifica Esito Incerto (CR-10) */}
      <VerificaEsitoDialog
        invoice={verificaInvoice}
        onClose={() => setVerificaInvoice(null)}
        onConfirm={(id) => handleRipristina(id, true)}
        isPending={isPending}
      />

      {/* Modale Correzione Rapida Fattura */}
      <FixInvoiceTsDialog
        invoice={fixingInvoice}
        open={fixingInvoice !== null}
        onOpenChange={(open) => {
          if (!open) setFixingInvoice(null);
        }}
        onSuccess={(msg) => {
          setActionSuccess(msg ?? "Dati della fattura aggiornati con successo.");
          router.refresh();
        }}
        otherDraftsCount={otherDraftsCount}
      />
    </div>
  );
}
