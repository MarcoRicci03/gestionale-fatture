"use client";

import type { RefObject } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { SOGLIA_BOLLO } from "@/lib/constants/bollo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateDisplay, isDataPagamentoFutura } from "@/lib/utils/date";
import { getTotaleConBollo } from "@/lib/invoices/bollo-total";
import { InvoiceRowActions } from "./invoice-row-actions";
import type { InvoiceListItem } from "./types";

type InvoicesTableProps = {
  invoices: InvoiceListItem[];
  selectedIds: Set<number>;
  selectAllRef: RefObject<HTMLInputElement | null>;
  toggleSelected: (id: number, checked: boolean) => void;
  toggleSelectAll: (checked: boolean) => void;
  onView: (invoice: InvoiceListItem) => void;
  onOpenRefreshPdf: (invoice: InvoiceListItem) => void;
  onOpenRefreshAnagrafica: (invoice: InvoiceListItem) => void;
  onEdit: (invoice: InvoiceListItem) => void;
};

export function InvoicesTable({
  invoices,
  selectedIds,
  selectAllRef,
  toggleSelected,
  toggleSelectAll,
  onView,
  onOpenRefreshPdf,
  onOpenRefreshAnagrafica,
  onEdit,
}: InvoicesTableProps) {
  return (
    <div className="hidden flex-1 min-h-56 overflow-auto rounded-lg border border-border bg-card lg:block">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
          <TableRow>
            <TableHead className="w-8">
              <input
                type="checkbox"
                role="checkbox"
                ref={selectAllRef}
                className="h-4 w-4 rounded border-input"
                checked={
                  invoices.length > 0 &&
                  invoices.every((i) => selectedIds.has(i.id))
                }
                onChange={(e) => toggleSelectAll(e.target.checked)}
                aria-label="Seleziona tutte le fatture visibili"
              />
            </TableHead>
            <TableHead>N. Fattura</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Pagante</TableHead>
            <TableHead>Paziente</TableHead>
            <TableHead>Importo</TableHead>
            <TableHead>Modalità</TableHead>
            <TableHead>Stato TS</TableHead>
            <TableHead className="w-32 text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>
                <input
                  type="checkbox"
                  role="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={selectedIds.has(invoice.id)}
                  onChange={(e) =>
                    toggleSelected(invoice.id, e.target.checked)
                  }
                  aria-label={`Seleziona fattura ${invoice.n_fattura}`}
                />
              </TableCell>
              <TableCell className="font-medium">
                {invoice.n_fattura}
              </TableCell>
              <TableCell>
                <div>{formatDateDisplay(invoice.data)}</div>
                {invoice.data_pagamento && (
                  <div className="text-xs text-muted-foreground">
                    Pag: {formatDateDisplay(invoice.data_pagamento)}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {invoice.pagante
                  ? `${invoice.pagante.cognome} ${invoice.pagante.nome}`
                  : "-"}
              </TableCell>
              <TableCell>
                {invoice.paziente
                  ? `${invoice.paziente.cognome} ${invoice.paziente.nome}`
                  : "-"}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5">
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
              </TableCell>
              <TableCell>{invoice.mod_pag}</TableCell>
              <TableCell>
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
              </TableCell>
              <TableCell className="flex justify-end gap-1">
                <InvoiceRowActions
                  invoice={invoice}
                  onView={onView}
                  onRefreshPdf={onOpenRefreshPdf}
                  onRefreshAnagrafica={onOpenRefreshAnagrafica}
                  onEdit={onEdit}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
