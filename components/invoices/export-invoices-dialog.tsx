"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  EXPORT_COLUMNS,
  EXPORT_COLUMN_CATEGORY_LABELS,
  type ExportColumnCategory,
} from "@/lib/excel/column-catalog";
import { MAX_EXPORT_INVOICES } from "@/lib/validations/invoice-export";
import type { InvoiceFilters } from "./invoice-filters";

const DEFAULT_SELECTED_COLUMNS = new Set(EXPORT_COLUMNS.map((c) => c.key));

const CATEGORY_ORDER: ExportColumnCategory[] = [
  "fattura",
  "pagante",
  "paziente",
  "dettaglio",
];

type ExportSelection =
  | { kind: "ids"; ids: number[] }
  | { kind: "filters"; filters: InvoiceFilters; count: number };

type ExportInvoicesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: ExportSelection;
};

export function ExportInvoicesDialog({
  open,
  onOpenChange,
  selection,
}: ExportInvoicesDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(DEFAULT_SELECTED_COLUMNS)
  );
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportCount = selection.kind === "ids" ? selection.ids.length : selection.count;
  const overLimit = exportCount > MAX_EXPORT_INVOICES;

  const toggleColumn = (key: string, checked: boolean) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleExport = async () => {
    setError(null);
    setIsExporting(true);
    try {
      const response = await fetch("/api/invoices/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(selection.kind === "ids"
            ? { ids: selection.ids }
            : { filters: selection.filters }),
          columns: Array.from(selectedColumns),
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          setError(
            retryAfter
              ? `Troppe richieste, riprova tra ${retryAfter} secondi.`
              : "Troppe richieste, riprova tra qualche istante."
          );
        } else if (response.status === 413) {
          setError(
            "Il file generato è troppo grande: restringi i filtri o la selezione."
          );
        } else {
          setError("Esportazione non riuscita. Riprova.");
        }
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fatture-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onOpenChange(false);
    } catch {
      setError("Esportazione non riuscita: controlla la connessione e riprova.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isExporting) onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Esporta fatture in Excel</DialogTitle>
          <DialogDescription>
            Scegli quali colonne includere nel file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm">
            Verranno esportate <span className="font-medium">{exportCount}</span>{" "}
            fattur{exportCount === 1 ? "a" : "e"}.
          </p>

          {overLimit && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Puoi esportare al massimo {MAX_EXPORT_INVOICES} fatture alla
              volta: restringi i filtri o la selezione.
            </p>
          )}

          {CATEGORY_ORDER.map((category) => (
            <div key={category} className="space-y-2">
              <p className="text-sm font-medium">
                {EXPORT_COLUMN_CATEGORY_LABELS[category]}
              </p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {EXPORT_COLUMNS.filter((c) => c.category === category).map(
                  (column) => (
                    <label
                      key={column.key}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        role="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={selectedColumns.has(column.key)}
                        onChange={(e) =>
                          toggleColumn(column.key, e.target.checked)
                        }
                      />
                      {column.label}
                    </label>
                  )
                )}
              </div>
            </div>
          ))}

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Annulla
          </Button>
          <Button
            onClick={handleExport}
            disabled={
              isExporting || overLimit || selectedColumns.size === 0
            }
          >
            {isExporting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Esporta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
