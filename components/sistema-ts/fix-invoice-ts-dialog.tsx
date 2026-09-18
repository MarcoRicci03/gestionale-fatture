"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  ShieldAlert,
} from "lucide-react";
import { validateCodiceFiscale } from "@/lib/sistemats/cf-validator";
import { formatDateInput } from "@/lib/utils/date";
import { correggiFatturaTs } from "@/lib/actions/sistema-ts";
import type { FatturaTsListItem } from "@/lib/data/sistema-ts";

export interface FixInvoiceTsDialogProps {
  invoice: FatturaTsListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (message?: string) => void;
  otherDraftsCount?: number;
}

export function FixInvoiceTsDialog({
  invoice,
  open,
  onOpenChange,
  onSuccess,
  otherDraftsCount = 0,
}: FixInvoiceTsDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  // Form states
  const [cf, setCf] = useState("");
  const [aggiornaAnagrafica, setAggiornaAnagrafica] = useState(true);
  const [propagaFattureInAttesa, setPropagaFattureInAttesa] = useState(false);
  const [flagOpposizione, setFlagOpposizione] = useState(false);
  const [dataPagamento, setDataPagamento] = useState("");
  const [pagamentoTracciato, setPagamentoTracciato] = useState(true);
  const [bolloCodice, setBolloCodice] = useState("");

  // Populate or reset form whenever target invoice changes
  useEffect(() => {
    if (invoice && open) {
      setCf(invoice.paganteCf ?? "");
      setAggiornaAnagrafica(true);
      setPropagaFattureInAttesa(false);
      setFlagOpposizione(invoice.flag_opposizione ?? false);
      const effectiveDate = invoice.data_pagamento ?? invoice.data;
      setDataPagamento(formatDateInput(effectiveDate));
      setPagamentoTracciato(invoice.pagamento_tracciato ?? true);
      setBolloCodice(invoice.bolloCodice ?? "");
      setServerError(null);
    }
  }, [invoice, open]);

  // Real-time Codice Fiscale validation
  const cfValidation = useMemo(() => {
    const trimmed = cf.trim().toUpperCase();
    if (!trimmed) {
      return { valid: false, error: "Codice Fiscale mancante" };
    }
    return validateCodiceFiscale(trimmed);
  }, [cf]);

  // Real-time payment date check against future date [S036]
  const isDateFuture = useMemo(() => {
    if (!dataPagamento) return false;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const [y, m, d] = dataPagamento.split("-").map(Number);
    if (!y || !m || !d) return false;
    const selected = new Date(y, m - 1, d, 12, 0, 0);
    return selected > today;
  }, [dataPagamento]);

  // Bollo validation
  const requiresBollo = invoice ? invoice.prezzo_totale > 77.47 : false;
  const isBolloValid = useMemo(() => {
    if (!requiresBollo) return true;
    if (!bolloCodice) return false;
    return /^\d{14}$/.test(bolloCodice.trim());
  }, [requiresBollo, bolloCodice]);

  const canSubmit = useMemo(() => {
    if (flagOpposizione) return true;
    return cfValidation.valid;
  }, [flagOpposizione, cfValidation.valid]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    if (!canSubmit) {
      setServerError(
        "Correggi il Codice Fiscale o seleziona l'opposizione alla trasmissione prima di procedere."
      );
      return;
    }

    setServerError(null);
    startTransition(async () => {
      const result = await correggiFatturaTs({
        invoiceId: invoice.id,
        paganteCf: cf.trim().toUpperCase() || null,
        aggiornaAnagrafica,
        propagaFattureInAttesa: otherDraftsCount > 0 ? propagaFattureInAttesa : false,
        flagOpposizione,
        dataPagamento: dataPagamento || null,
        pagamentoTracciato,
        bolloCodice: bolloCodice.trim() || null,
      });

      if ("error" in result) {
        setServerError(result.error);
        return;
      }

      onOpenChange(false);
      onSuccess(
        result.message ??
          `Fattura n. ${invoice.n_fattura}/${invoice.anno} corretta con successo.`
      );
    });
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Correggi dati per Sistema TS — Fattura #{invoice.n_fattura}/{invoice.anno}
          </DialogTitle>
          <DialogDescription>
            Intestatario:{" "}
            <span className="font-semibold text-foreground">
              {invoice.paganteNomeCompleto}
            </span>{" "}
            • Paziente:{" "}
            <span className="font-semibold text-foreground">
              {invoice.pazienteNomeCompleto}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Banner anomalia contestuale */}
          {(!invoice.cfValido || invoice.isDataFutura || invoice.bolloMancante) && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-50/60 dark:bg-amber-950/30 p-3.5 text-sm space-y-1">
              <div className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Anomalie rilevate per la trasmissione telematiche:</span>
              </div>
              <ul className="list-disc list-inside text-xs text-amber-800 dark:text-amber-300 pl-1 space-y-0.5">
                {!invoice.cfValido && (
                  <li>{invoice.cfErrore || "Codice Fiscale non valido o mancante"}</li>
                )}
                {invoice.isDataFutura && (
                  <li>
                    Data incasso successiva ad oggi: comporterà scarto ministeriale [S036]
                  </li>
                )}
                {invoice.bolloMancante && (
                  <li>
                    Importo superiore a 77,47 €: inserire il codice a 14 cifre della marca da bollo
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Sezione Codice Fiscale */}
          <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="paganteCf" className="font-medium">
                  Codice Fiscale Pagante
                </Label>
                {!flagOpposizione && cf.trim().length > 0 && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium ${
                      cfValidation.valid
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive"
                    }`}
                  >
                    {cfValidation.valid ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        CF Valido (CIN verificato)
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {cfValidation.error}
                      </>
                    )}
                  </span>
                )}
              </div>
              <Input
                id="paganteCf"
                value={cf}
                onChange={(e) => setCf(e.target.value.toUpperCase())}
                placeholder="es. RSSMRA80A01H501U"
                maxLength={16}
                className="font-mono uppercase tracking-wider"
                disabled={isPending || flagOpposizione}
              />
            </div>

            {/* Checkbox 1: Aggiornamento anagrafica cliente */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={aggiornaAnagrafica}
                  onChange={(e) => setAggiornaAnagrafica(e.target.checked)}
                  disabled={isPending || flagOpposizione}
                  className="h-4 w-4 mt-0.5 rounded border-input text-primary focus:ring-primary"
                />
                <span className="text-muted-foreground">
                  <strong className="font-medium text-foreground">
                    Aggiorna anche l'anagrafica del cliente:
                  </strong>{" "}
                  le prossime fatture create per questo cliente useranno questo Codice Fiscale.
                </span>
              </label>
            </div>

            {/* Checkbox 2: Propagazione su altre fatture in attesa di invio */}
            {otherDraftsCount > 0 && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5">
                <label className="flex items-start gap-2.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={propagaFattureInAttesa}
                    onChange={(e) => setPropagaFattureInAttesa(e.target.checked)}
                    disabled={isPending || flagOpposizione}
                    className="h-4 w-4 mt-0.5 rounded border-input text-primary focus:ring-primary"
                  />
                  <span>
                    <strong className="font-semibold text-foreground">
                      Applica la correzione anche alle altre {otherDraftsCount}{" "}
                      {otherDraftsCount === 1 ? "fattura" : "fatture"} non ancora inviate
                    </strong>{" "}
                    di questo cliente.
                    <span className="block text-muted-foreground mt-0.5">
                      Attiva questa spunta se si trattava di un refuso di battitura da correggere su tutte le bozze.
                      Lasciala deselezionata se vuoi mantenere intestazioni diverse (es. alternanza madre/padre).
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Diritto di opposizione */}
          <div className="rounded-lg border p-4 bg-muted/20">
            <label className="flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={flagOpposizione}
                onChange={(e) => setFlagOpposizione(e.target.checked)}
                disabled={isPending}
                className="h-4 w-4 mt-0.5 rounded border-input text-primary focus:ring-primary"
              />
              <div>
                <span className="font-medium text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Il paziente esercita opposizione alla trasmissione (ex DM 31/07/2015)
                </span>
                <p className="text-muted-foreground mt-1">
                  Se selezionato, la spesa verrà inviata a Sistema TS senza Codice Fiscale e non sarà
                  inserita nel 730 precompilato dell'assistito.
                </p>
              </div>
            </label>
          </div>

          {/* Data incasso e tracciabilità */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dataPagamento">Data di effettivo incasso</Label>
              <Input
                id="dataPagamento"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Principio di cassa: data in cui il pagamento è stato effettivamente percepito.
              </p>
              {isDateFuture && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  Data futura: non potrà essere inviata prima di tale data.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tracciabilità del pagamento</Label>
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="pagamentoTracciato"
                    checked={pagamentoTracciato}
                    onChange={() => setPagamentoTracciato(true)}
                    disabled={isPending}
                    className="h-4 w-4 text-primary"
                  />
                  <span>Tracciato (Bonifico, Carta, POS, Assegno)</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="pagamentoTracciato"
                    checked={!pagamentoTracciato}
                    onChange={() => setPagamentoTracciato(false)}
                    disabled={isPending}
                    className="h-4 w-4 text-primary"
                  />
                  <span>Non tracciato (Contanti)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Codice Marca da Bollo (se > 77.47) */}
          {requiresBollo && (
            <div className="space-y-2 rounded-lg border p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label htmlFor="bolloCodice" className="font-medium">
                  Codice Marca da Bollo (14 cifre)
                </Label>
                <span className="text-xs text-muted-foreground">
                  Importo fattura: {invoice.prezzo_totale.toFixed(2)} € (&gt; 77,47 €)
                </span>
              </div>
              <Input
                id="bolloCodice"
                value={bolloCodice}
                onChange={(e) => setBolloCodice(e.target.value.replace(/\D/g, "").slice(0, 14))}
                placeholder="es. 01201234567890"
                maxLength={14}
                className="font-mono"
                disabled={isPending}
              />
              {!isBolloValid && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Per importi superiori a 77,47 € è richiesto un identificativo di 14 cifre numeriche.
                </p>
              )}
            </div>
          )}

          {/* Messaggio di errore del server */}
          {serverError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={isPending || !canSubmit}>
              {isPending ? "Salvataggio..." : "Salva correzioni"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
