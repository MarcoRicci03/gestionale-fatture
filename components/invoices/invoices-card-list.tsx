"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { SOGLIA_BOLLO } from "@/lib/constants/bollo";
import { formatDateDisplay, isDataPagamentoFutura } from "@/lib/utils/date";
import { getTotaleConBollo } from "@/lib/invoices/bollo-total";
import { InvoiceRowActions } from "./invoice-row-actions";
import type { InvoiceListItem } from "./types";

type InvoicesCardListProps = {
  invoices: InvoiceListItem[];
  selectedIds: Set<number>;
  toggleSelected: (id: number, checked: boolean) => void;
  onView: (invoice: InvoiceListItem) => void;
  onOpenRefreshPdf: (invoice: InvoiceListItem) => void;
  onOpenRefreshAnagrafica: (invoice: InvoiceListItem) => void;
  onEdit: (invoice: InvoiceListItem) => void;
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
        <li key={invoice.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
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
                {invoice.data_pagamento && (
                  <p className="text-xs text-muted-foreground">
                    Pag: {formatDateDisplay(invoice.data_pagamento)}
                  </p>
                )}
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
                  <span title="Marca da bollo dovuta: codice non ancora inserito">
                    <AlertTriangle
                      className="h-4 w-4 text-amber-600"
                      aria-label="Marca da bollo dovuta: codice non ancora inserito"
                    />
                  </span>
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
            <div className="flex items-center justify-between">
              <p>Modalità: {invoice.mod_pag}</p>
              <div>
                {invoice.stato_ts === "INVIATA" && (
                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-400">
                    Inviata
                  </span>
                )}
                {invoice.stato_ts === "IN_TRASMISSIONE" && (
                  <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-400">
                    In trasmissione
                  </span>
                )}
                {invoice.stato_ts === "DA_INVIARE" &&
                  (isDataPagamentoFutura(invoice.data_pagamento, invoice.data) ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-400"
                      title="Incasso futuro: trasmissibile a Sistema TS solo a partire dalla data di incasso"
                    >
                      <Clock className="h-3 w-3" />
                      Da inviare (futura)
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-950/30 dark:text-blue-400">
                      Da inviare
                    </span>
                  ))}
                {invoice.stato_ts === "DA_CANCELLARE_SU_TS" && (
                  <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-400">
                    Da cancellare
                  </span>
                )}
                {invoice.stato_ts === "ANNULLATA_TS" && (
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400 line-through">
                    Annullata
                  </span>
                )}
              </div>
            </div>
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
