"use client";

import { AlertTriangle, AlertCircle, ArrowRight } from "lucide-react";
import { getSogeiErrorHelper } from "@/lib/sistemats/error-catalog";
import type { ErroreDocumentoTs } from "@/lib/sistemats/csv-parser";

interface SogeiErrorItemProps {
  error: ErroreDocumentoTs;
  showGuidance?: boolean;
}

export function SogeiErrorItem({ error, showGuidance = true }: SogeiErrorItemProps) {
  const helper = getSogeiErrorHelper(error.codiceErrore, error.descrizione, error.tipo);

  if (helper.gravita === "INFO") {
    return (
      <div className="rounded-md bg-amber-500/10 p-2.5 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 space-y-1 whitespace-normal break-words">
        <div className="font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>[{helper.codice}] {helper.titolo}</span>
        </div>
        <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
          {helper.significato}
        </p>
        {showGuidance && helper.azioneConsigliata && (
          <div className="mt-1 pt-1 border-t border-amber-500/20 text-[11px] flex items-start gap-1 text-amber-800 dark:text-amber-300">
            <span className="font-semibold shrink-0">Cosa fare:</span>
            <span className="min-w-0 flex-1 break-words">{helper.azioneConsigliata}</span>
          </div>
        )}
      </div>
    );
  }

  if (helper.gravita === "WARNING") {
    return (
      <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 p-2.5 border border-amber-300 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 space-y-1 whitespace-normal break-words">
        <div className="font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>[{helper.codice}] {helper.titolo}</span>
        </div>
        <div className="text-[11px] text-muted-foreground flex items-start gap-1">
          <span className="font-medium shrink-0">Tracciato Sogei:</span>
          <span className="min-w-0 flex-1 break-words">{error.descrizione || helper.significato}</span>
        </div>
        {showGuidance && helper.azioneConsigliata && (
          <div className="mt-1 pt-1 border-t border-amber-200 dark:border-amber-900/40 text-[11px] flex items-start gap-1 text-amber-800 dark:text-amber-300">
            <span className="font-semibold shrink-0">Cosa fare:</span>
            <span className="min-w-0 flex-1 break-words">{helper.azioneConsigliata}</span>
          </div>
        )}
      </div>
    );
  }

  // ERRORE (Scarto ministeriale)
  return (
    <div className="rounded-md bg-destructive/10 p-2.5 border border-destructive/25 text-xs text-foreground space-y-1 whitespace-normal break-words">
      <div className="font-semibold flex items-center gap-1.5 text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>[{helper.codice}] {helper.titolo}</span>
      </div>
      <div className="text-[11px] text-muted-foreground flex items-start gap-1">
        <span className="font-medium shrink-0">Motivo scarto:</span>
        <span className="text-foreground/90 min-w-0 flex-1 break-words">{error.descrizione || helper.significato}</span>
      </div>
      {showGuidance && helper.azioneConsigliata && (
        <div className="mt-1 pt-1 border-t border-destructive/20 text-[11px] flex items-start gap-1.5 text-foreground/90">
          <ArrowRight className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1 break-words">
            <span className="font-semibold text-destructive mr-1">Cosa fare:</span>
            <span>{helper.azioneConsigliata}</span>
          </div>
        </div>
      )}
    </div>
  );
}
