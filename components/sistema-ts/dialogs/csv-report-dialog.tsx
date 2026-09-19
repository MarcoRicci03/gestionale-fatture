"use client";

import { useState, useMemo } from "react";
import { FileText, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseCsvErroriTs, type ErroreDocumentoTs } from "@/lib/sistemats/csv-parser";
import { SogeiErrorBadge } from "../sogei-error-item";

export type CsvReportDialogProps = {
  csvContent: string | null;
  onClose: () => void;
};

export function CsvReportDialog({
  csvContent,
  onClose,
}: CsvReportDialogProps) {
  const [csvViewMode, setCsvViewMode] = useState<"guide" | "raw">("guide");

  const parsedCsvErrors = useMemo(() => {
    if (!csvContent) return [];
    const map = parseCsvErroriTs(csvContent);
    const result: Array<{ numDoc: string; errors: ErroreDocumentoTs[] }> = [];
    map.forEach((errors, numDoc) => {
      result.push({ numDoc, errors });
    });
    return result;
  }, [csvContent]);

  return (
    <Dialog
      open={!!csvContent}
      onOpenChange={(open) => !open && onClose()}
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

        <div className="flex items-center gap-2 pt-1 border-b pb-2">
          <Button
            variant={csvViewMode === "guide" ? "secondary" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setCsvViewMode("guide")}
          >
            Guida Anomalie
          </Button>
          <Button
            variant={csvViewMode === "raw" ? "secondary" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setCsvViewMode("raw")}
          >
            CSV Originale
          </Button>
        </div>

        <div className="flex-1 overflow-auto rounded border border-border bg-muted/40 p-3 my-2 min-h-[160px]">
          {csvViewMode === "guide" ? (
            parsedCsvErrors.length > 0 ? (
              <div className="space-y-3">
                {parsedCsvErrors.map(({ numDoc, errors }) => (
                  <div
                    key={numDoc}
                    className="rounded-lg border border-border/80 p-3 space-y-2 bg-background/80"
                  >
                    <div className="text-xs font-semibold flex items-center justify-between border-b pb-1.5">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Fattura Documento N. <span className="font-mono font-bold">{numDoc}</span></span>
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {errors.length} {errors.length === 1 ? "segnalazione" : "segnalazioni"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {errors.map((err, errIdx) => (
                        <SogeiErrorBadge key={errIdx} error={err} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground p-2">
                Nessuna riga di errore o segnalazione strutturata rilevata nel file.
              </p>
            )
          ) : (
            <pre className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
              {csvContent}
            </pre>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!csvContent) return;
              const blob = new Blob([csvContent], {
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
            onClick={onClose}
          >
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
