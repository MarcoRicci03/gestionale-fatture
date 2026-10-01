"use client";

import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "../types";

export type BatchConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFattureCount: number;
  selectedTotalImporto: number;
  isPending: boolean;
  onConfirm: () => void;
};

export function BatchConfirmDialog({
  open,
  onOpenChange,
  selectedFattureCount,
  selectedTotalImporto,
  isPending,
  onConfirm,
}: BatchConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conferma invio a Sistema TS</DialogTitle>
          <DialogDescription>
            Stai per trasmettere telematicamente {selectedFattureCount} documenti di spesa al
            Sistema Tessera Sanitaria (Sogei / MEF).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          <div className="rounded-lg bg-muted p-3 space-y-1 text-xs">
            <p>• Totale fatture selezionate: <strong>{selectedFattureCount}</strong></p>
            <p>• Totale onorari: <strong>{formatCurrency(selectedTotalImporto)}</strong></p>
            <p>• Verrà generato un archivio ZIP conforme allo schema <strong>v2.5</strong></p>
            <p>• I Codici Fiscali e il PinCode saranno cifrati con chiave pubblica RSA ministeriale</p>
          </div>

          {/* Box di Conformità Verificata */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-50/60 p-3 text-xs dark:bg-emerald-950/20 space-y-1.5 text-emerald-900 dark:text-emerald-300">
            <div className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Verifiche preventive superate con successo:</span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground dark:text-emerald-400/80">
              <li>Date incasso conformi: tutte le spese hanno data incasso &le; oggi ({formatDate(new Date())}) ex DM 19/10/2020.</li>
              <li>Dati anagrafici e Codici Fiscali validati (o coperti da opposizione del paziente).</li>
              <li>Importi conformi ai limiti ministeriali (min 0,01 €, max 99.999,99 €).</li>
            </ul>
          </div>

          {/* Alert normativo pre-invio */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-50/60 p-3 text-xs dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Rilevanza fiscale per il 730 precompilato</p>
              <p className="text-[11px] text-muted-foreground dark:text-amber-400/80 mt-0.5">
                I documenti trasmessi saranno registrati ufficialmente presso l&apos;Agenzia delle Entrate.
                Una volta inviate, eventuali modifiche richiederanno una procedura telematica formale di annullamento o reinvio.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annulla
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
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
  );
}
