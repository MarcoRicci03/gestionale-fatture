"use client";

import { AlertTriangle, AlertCircle, Info, ArrowRight } from "lucide-react";
import { getSogeiErrorHelper } from "@/lib/sistemats/error-catalog";
import type { ErroreDocumentoTs } from "@/lib/sistemats/csv-parser";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SogeiErrorBadgeProps {
  error: ErroreDocumentoTs;
  showGuidance?: boolean;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export function SogeiErrorBadge({
  error,
  showGuidance = true,
  className,
  side = "top",
  align = "start",
}: SogeiErrorBadgeProps) {
  const helper = getSogeiErrorHelper(error.codiceErrore, error.descrizione, error.tipo);

  const isInfo = helper.gravita === "INFO";
  const isWarning = helper.gravita === "WARNING";
  const isError = helper.gravita === "ERRORE";

  const chipClasses = cn(
    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium border transition-colors cursor-pointer select-none text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
    isInfo &&
      "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/20 data-[popup-open]:bg-blue-500/20",
    isWarning &&
      "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20 data-[popup-open]:bg-amber-500/20",
    isError &&
      "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 data-[popup-open]:bg-destructive/20",
    className
  );

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={120}
        className={chipClasses}
        aria-label={`Dettagli anomalia ${helper.codice}: ${helper.etichetta}`}
      >
        {isInfo && <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        {isWarning && <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        {isError && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        <span className="font-mono font-semibold">[{helper.codice}]</span>
        <span className="opacity-40">·</span>
        <span className="truncate max-w-[190px] sm:max-w-[250px]">{helper.etichetta}</span>
      </PopoverTrigger>

      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        className="w-88 sm:w-[28rem] p-3.5 space-y-2.5 text-xs shadow-lg bg-popover text-popover-foreground border-border"
      >
        {/* Intestazione */}
        <div
          className={cn(
            "font-semibold flex items-start gap-2 text-sm pb-2 border-b border-border/60",
            isInfo && "text-blue-700 dark:text-blue-400",
            isWarning && "text-amber-700 dark:text-amber-400",
            isError && "text-destructive"
          )}
        >
          {isInfo && <Info className="h-4 w-4 shrink-0 mt-0.5" />}
          {isWarning && <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
          {isError && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
          <span className="leading-snug">
            [{helper.codice}] {helper.titolo}
          </span>
        </div>

        {/* Tracciato ministeriale Sogei */}
        <div className="text-xs text-muted-foreground flex items-start gap-2 bg-muted/50 p-2.5 rounded border border-border/40">
          <span className="font-semibold shrink-0 text-foreground/80">
            {isError ? "Motivo scarto:" : "Tracciato Sogei:"}
          </span>
          <span className="font-mono text-foreground break-words flex-1 leading-relaxed">
            {error.descrizione || helper.significato}
          </span>
        </div>

        {/* Significato helper se diverso dalla stringa grezza Sogei */}
        {error.descrizione &&
          helper.significato &&
          error.descrizione.trim().toLowerCase() !== helper.significato.trim().toLowerCase() && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {helper.significato}
            </p>
          )}

        {/* Sezione Cosa fare */}
        {showGuidance && helper.azioneConsigliata && (
          <div className="pt-2 border-t border-border/60 text-xs flex items-start gap-2">
            <ArrowRight
              className={cn(
                "h-4 w-4 shrink-0 mt-0.5",
                isError ? "text-destructive" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-blue-600"
              )}
            />
            <div className="flex-1 min-w-0">
              <span
                className={cn(
                  "font-semibold mr-1.5",
                  isError ? "text-destructive" : isWarning ? "text-amber-700 dark:text-amber-400" : "text-blue-700"
                )}
              >
                Cosa fare:
              </span>
              <span className="text-foreground/90 leading-relaxed">{helper.azioneConsigliata}</span>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
