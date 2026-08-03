"use client";

import { useState, useTransition } from "react";
import { PlusCircle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INVOICES_PAGE_SIZE } from "@/lib/constants/invoices";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvoiceForm } from "./invoice-form";
import { InvoicesTable } from "./invoices-table";
import { InvoicesCardList } from "./invoices-card-list";
import { InvoiceDetailDialog } from "./invoice-detail-dialog";
import { PayerDetailDialog } from "./payer-detail-dialog";
import { PatientDetailDialog } from "./patient-detail-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { refreshInvoicePdfLayout } from "@/lib/actions/settings";
import { refreshInvoiceAnagrafica } from "@/lib/actions/invoices";
import { InvoicesFilterBar } from "./invoices-filter-bar";
import { ListPagination } from "@/components/ui/list-pagination";
import type { InvoiceFilters } from "./invoice-filters";
import { useInvoiceFilters } from "./use-invoice-filters";
import { useInvoiceSelection } from "./use-invoice-selection";
import { ExportInvoicesDialog } from "./export-invoices-dialog";
import type { Pagante, Paziente } from "@prisma/client";
import type {
  PayerOption,
  PatientOption,
} from "@/lib/data/invoice-contact-options-select";
import type { InvoiceListItem } from "./types";

type InvoicesManagerProps = {
  invoices: InvoiceListItem[];
  totalCount: number;
  page: number;
  years: number[];
  filters: InvoiceFilters;
  payers: PayerOption[];
  patients: PatientOption[];
  nextInvoiceNumber: number;
};

export function InvoicesManager({
  invoices,
  totalCount,
  page,
  years,
  filters,
  payers,
  patients,
  nextInvoiceNumber,
}: InvoicesManagerProps) {
  const { handleFiltersChange, handleReset, handlePageChange } =
    useInvoiceFilters({ filters });

  const [open, setOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceListItem | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceListItem | null>(null);
  const [viewingPayer, setViewingPayer] = useState<Pagante | null>(null);
  const [viewingPatient, setViewingPatient] = useState<
    (Paziente & { pagante: Pagante | null }) | null
  >(null);
  const [refreshInvoiceId, setRefreshInvoiceId] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [anagraficaRefreshInvoiceId, setAnagraficaRefreshInvoiceId] = useState<number | null>(null);
  const [anagraficaRefreshError, setAnagraficaRefreshError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { selectedIds, selectAllRef, toggleSelected, toggleSelectAll } =
    useInvoiceSelection({ invoices, filters, page });

  const handleOpenNew = () => {
    setEditingInvoice(null);
    setOpen(true);
  };

  const handleOpenEdit = (invoice: InvoiceListItem) => {
    setEditingInvoice(invoice);
    setOpen(true);
  };

  const handleOpenView = (invoice: InvoiceListItem) => {
    setViewingInvoice(invoice);
  };

  const handleOpenRefreshPdf = (invoice: InvoiceListItem) => {
    setRefreshError(null);
    setRefreshInvoiceId(invoice.id);
  };

  const handleOpenRefreshAnagrafica = (invoice: InvoiceListItem) => {
    setAnagraficaRefreshError(null);
    setAnagraficaRefreshInvoiceId(invoice.id);
  };

  const handleSuccess = () => {
    setOpen(false);
    setEditingInvoice(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-6">
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fatture</h1>
          <p className="text-muted-foreground">Gestione fatture e pagamenti</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setExportDialogOpen(true)}
            disabled={totalCount === 0}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Esporta Excel
          </Button>
          <Button onClick={handleOpenNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuova fattura
          </Button>
        </div>
      </div>

      {years.length === 0 ? (
        <p className="text-muted-foreground">Nessuna fattura emessa.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <div className="shrink-0">
            <InvoicesFilterBar
              filters={filters}
              onChange={handleFiltersChange}
              onReset={handleReset}
              payers={payers}
              patients={patients}
              years={years}
            />
          </div>

          {invoices.length === 0 ? (
            <p className="text-muted-foreground">
              Nessuna fattura corrisponde ai filtri selezionati.
            </p>
          ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-6">
          <InvoicesTable
            invoices={invoices}
            selectedIds={selectedIds}
            selectAllRef={selectAllRef}
            toggleSelected={toggleSelected}
            toggleSelectAll={toggleSelectAll}
            onView={handleOpenView}
            onOpenRefreshPdf={handleOpenRefreshPdf}
            onOpenRefreshAnagrafica={handleOpenRefreshAnagrafica}
            onEdit={handleOpenEdit}
          />

          <InvoicesCardList
            invoices={invoices}
            selectedIds={selectedIds}
            toggleSelected={toggleSelected}
            onView={handleOpenView}
            onOpenRefreshPdf={handleOpenRefreshPdf}
            onOpenRefreshAnagrafica={handleOpenRefreshAnagrafica}
            onEdit={handleOpenEdit}
          />

          <div className="shrink-0">
            <ListPagination
              page={page}
              totalCount={totalCount}
              pageSize={INVOICES_PAGE_SIZE}
              itemLabel="fatture"
              onPageChange={handlePageChange}
            />
          </div>
          </div>
          )}
        </div>
      )}

      <ExportInvoicesDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        selection={
          selectedIds.size > 0
            ? { kind: "ids", ids: Array.from(selectedIds) }
            : { kind: "filters", filters, count: totalCount }
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingInvoice ? "Modifica Fattura" : "Nuova Fattura"}
            </DialogTitle>
          </DialogHeader>
          <InvoiceForm
            invoice={editingInvoice ?? undefined}
            payers={payers}
            patients={patients}
            nextInvoiceNumber={nextInvoiceNumber}
            onSuccess={handleSuccess}
          />
        </DialogContent>
      </Dialog>

      <InvoiceDetailDialog
        invoice={viewingInvoice}
        onOpenChange={(isOpen) => !isOpen && setViewingInvoice(null)}
        onViewPayer={setViewingPayer}
        onViewPatient={setViewingPatient}
      />

      <ConfirmDialog
        open={refreshInvoiceId !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRefreshInvoiceId(null);
        }}
        title="Aggiorna layout PDF"
        description="La fattura verrà renderizzata con il layout attuale. Sei sicuro?"
        confirmLabel="Aggiorna"
        isPending={isPending}
        onConfirm={() => {
          if (refreshInvoiceId == null) return;
          startTransition(async () => {
            const result = await refreshInvoicePdfLayout(refreshInvoiceId);
            if (!result.success) {
              setRefreshError(result.error);
            }
            setRefreshInvoiceId(null);
          });
        }}
      />

      {refreshError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {refreshError}
        </p>
      )}

      <ConfirmDialog
        open={anagraficaRefreshInvoiceId !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setAnagraficaRefreshInvoiceId(null);
        }}
        title="Aggiorna anagrafica"
        description="I dati di pagante e paziente salvati su questa fattura verranno sostituiti con quelli attuali. Da usare solo per correggere un errore nell'anagrafica originale, non per fatture già consegnate con dati diversi. Sei sicuro?"
        confirmLabel="Aggiorna"
        isPending={isPending}
        onConfirm={() => {
          if (anagraficaRefreshInvoiceId == null) return;
          startTransition(async () => {
            const result = await refreshInvoiceAnagrafica(anagraficaRefreshInvoiceId);
            if ("error" in result) {
              setAnagraficaRefreshError(result.error);
            }
            setAnagraficaRefreshInvoiceId(null);
          });
        }}
      />

      {anagraficaRefreshError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {anagraficaRefreshError}
        </p>
      )}

      <PayerDetailDialog
        payer={viewingPayer}
        onOpenChange={(isOpen) => !isOpen && setViewingPayer(null)}
      />

      <PatientDetailDialog
        patient={viewingPatient}
        onOpenChange={(isOpen) => !isOpen && setViewingPatient(null)}
      />
    </div>
  );
}
