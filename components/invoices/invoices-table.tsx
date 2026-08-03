"use client";

import type { RefObject } from "react";
import { AlertTriangle } from "lucide-react";
import { SOGLIA_BOLLO } from "@/lib/constants/bollo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { formatDateDisplay } from "@/lib/utils/date";
import { getTotaleConBollo } from "@/lib/invoices/bollo-total";
import { InvoiceRowActions } from "./invoice-row-actions";
import type { InvoiceWithRelations } from "./invoices-manager";

type InvoicesTableProps = {
  invoices: InvoiceWithRelations[];
  selectedIds: Set<number>;
  selectAllRef: RefObject<HTMLInputElement | null>;
  toggleSelected: (id: number, checked: boolean) => void;
  toggleSelectAll: (checked: boolean) => void;
  onView: (invoice: InvoiceWithRelations) => void;
  onOpenRefreshPdf: (invoice: InvoiceWithRelations) => void;
  onOpenRefreshAnagrafica: (invoice: InvoiceWithRelations) => void;
  onEdit: (invoice: InvoiceWithRelations) => void;
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
    <div className="hidden flex-1 min-h-56 overflow-y-auto rounded-lg border lg:block">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
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
              <TableCell>{formatDateDisplay(invoice.data)}</TableCell>
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
                      <Tooltip content="Marca da bollo dovuta: codice non ancora inserito">
                        <AlertTriangle
                          className="h-4 w-4 text-amber-600"
                          aria-label="Marca da bollo dovuta: codice non ancora inserito"
                        />
                      </Tooltip>
                    )}
                </span>
              </TableCell>
              <TableCell>{invoice.mod_pag}</TableCell>
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
