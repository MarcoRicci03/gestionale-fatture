"use client";

import { AlertTriangle } from "lucide-react";
import { SOGLIA_BOLLO } from "@/lib/constants/bollo";
import { Tooltip } from "@/components/ui/tooltip";
import { formatDateDisplay } from "@/lib/utils/date";
import { getTotaleConBollo } from "@/lib/invoices/bollo-total";
import { InvoiceRowActions } from "./invoice-row-actions";
import type { InvoiceWithRelations } from "./invoices-manager";

type InvoicesCardListProps = {
  invoices: InvoiceWithRelations[];
  selectedIds: Set<number>;
  toggleSelected: (id: number, checked: boolean) => void;
  onView: (invoice: InvoiceWithRelations) => void;
  onOpenRefreshPdf: (invoice: InvoiceWithRelations) => void;
  onOpenRefreshAnagrafica: (invoice: InvoiceWithRelations) => void;
  onEdit: (invoice: InvoiceWithRelations) => void;
};

export function InvoicesCardList({
  invoices,
  selectedIds,
  toggleSelected,
  onView,
  onOpenRefreshPdf,
  onOpenRefreshAnagrafica,
  onEdit,
}: InvoicesCardListProps) {
  return (
    <ul className="flex-1 min-h-56 space-y-3 overflow-y-auto lg:hidden">
      {invoices.map((invoice) => (
        <li key={invoice.id} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                role="checkbox"
                className="mt-1 h-4 w-4 rounded border-input"
                checked={selectedIds.has(invoice.id)}
                onChange={(e) => toggleSelected(invoice.id, e.target.checked)}
                aria-label={`Seleziona fattura ${invoice.n_fattura}`}
              />
              <div>
                <p className="font-medium">N. {invoice.n_fattura}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateDisplay(invoice.data)}
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 font-medium">
              {getTotaleConBollo(
                invoice.prezzo_totale,
                invoice.bolloCodice
              ).toLocaleString("it-IT", {
                style: "currency",
                currency: "EUR",
              })}
              {invoice.prezzo_totale > SOGLIA_BOLLO &&
                !invoice.bolloCodice && (
                  <Tooltip content="Marca da bollo dovuta: codice non ancora inserito">
                    <AlertTriangle
                      className="h-4 w-4 text-amber-600"
                      aria-label="Marca da bollo dovuta: codice non ancora inserito"
                    />
                  </Tooltip>
                )}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            <p>
              Pagante:{" "}
              {invoice.pagante
                ? `${invoice.pagante.cognome} ${invoice.pagante.nome}`
                : "-"}
            </p>
            <p>
              Paziente:{" "}
              {invoice.paziente
                ? `${invoice.paziente.cognome} ${invoice.paziente.nome}`
                : "-"}
            </p>
            <p>Modalità: {invoice.mod_pag}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1 border-t pt-3">
            <InvoiceRowActions
              invoice={invoice}
              onView={onView}
              onRefreshPdf={onOpenRefreshPdf}
              onRefreshAnagrafica={onOpenRefreshAnagrafica}
              onEdit={onEdit}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
