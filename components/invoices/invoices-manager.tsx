"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  PlusCircle,
  Pencil,
  FileText,
  FileSpreadsheet,
  Eye,
  RefreshCw,
  IdCard,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SOGLIA_BOLLO } from "@/lib/constants/bollo";
import { INVOICES_PAGE_SIZE } from "@/lib/constants/invoices";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceForm } from "./invoice-form";
import { DeleteInvoiceButton } from "./delete-invoice-button";
import { Tooltip } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDateDisplay } from "@/lib/utils/date";
import { refreshInvoicePdfLayout } from "@/lib/actions/settings";
import { refreshInvoiceAnagrafica } from "@/lib/actions/invoices";
import { resolveAnagrafica } from "@/lib/invoices/anagrafica-snapshot";
import { getTotaleConBollo } from "@/lib/invoices/bollo-total";
import { InvoicesFilterBar } from "./invoices-filter-bar";
import { ListPagination } from "@/components/ui/list-pagination";
import type { InvoiceFilters } from "./invoice-filters";
import { useInvoiceFilters } from "./use-invoice-filters";
import { ExportInvoicesDialog } from "./export-invoices-dialog";
import type { FatturaMese, Pagamento, Pagante, Paziente } from "@prisma/client";
import type {
  PayerOption,
  PatientOption,
} from "@/lib/data/invoice-contact-options-select";

// prezzo_totale/mesi[].prezzo arrivano già convertiti da Decimal a number
// (vedi serializeInvoice in lib/data/invoices.ts).
type InvoiceWithRelations = Omit<Pagamento, "prezzo_totale"> & {
  prezzo_totale: number;
  mesi: (Omit<FatturaMese, "prezzo"> & { prezzo: number })[];
  pagante: Pagante | null;
  paziente: Paziente | null;
};

type InvoicesManagerProps = {
  invoices: InvoiceWithRelations[];
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
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithRelations | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceWithRelations | null>(null);
  const [viewingPayer, setViewingPayer] = useState<Pagante | null>(null);
  const [viewingPatient, setViewingPatient] = useState<
    (Paziente & { pagante: Pagante | null }) | null
  >(null);
  const [refreshInvoiceId, setRefreshInvoiceId] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [anagraficaRefreshInvoiceId, setAnagraficaRefreshInvoiceId] = useState<number | null>(null);
  const [anagraficaRefreshError, setAnagraficaRefreshError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolvedAnagrafica = viewingInvoice?.pagante && viewingInvoice?.paziente
    ? resolveAnagrafica({
        snapshotAnagrafica: viewingInvoice.snapshotAnagrafica,
        pagante: viewingInvoice.pagante,
        paziente: viewingInvoice.paziente,
      })
    : null;

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Azzera la selezione ogni volta che filtri o pagina cambiano (nuova
  // navigazione dal server), per evitare di esportare "a sorpresa" righe non
  // più visibili. Aggiornamento di stato durante il render (pattern
  // consigliato da React per "adjusting state when a prop changes"), non in
  // un effect, per non innescare un render a cascata evitabile.
  const [prevFilters, setPrevFilters] = useState(filters);
  const [prevPage, setPrevPage] = useState(page);
  if (filters !== prevFilters || page !== prevPage) {
    setPrevFilters(filters);
    setPrevPage(page);
    setSelectedIds(new Set());
  }

  useEffect(() => {
    if (!selectAllRef.current) return;
    const selectedInView = invoices.filter((i) => selectedIds.has(i.id)).length;
    selectAllRef.current.indeterminate =
      selectedInView > 0 && selectedInView < invoices.length;
  }, [selectedIds, invoices]);

  const toggleSelected = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(invoices.map((i) => i.id)) : new Set());
  };

  const handleOpenNew = () => {
    setEditingInvoice(null);
    setOpen(true);
  };

  const handleOpenEdit = (invoice: InvoiceWithRelations) => {
    setEditingInvoice(invoice);
    setOpen(true);
  };

  const handleOpenView = (invoice: InvoiceWithRelations) => {
    setViewingInvoice(invoice);
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
                      <Tooltip content="Visualizza dettagli fattura">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenView(invoice)}
                          aria-label="Visualizza dettagli fattura"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Aggiorna layout PDF">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setRefreshError(null);
                            setRefreshInvoiceId(invoice.id);
                          }}
                          aria-label="Aggiorna layout PDF"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Aggiorna anagrafica">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setAnagraficaRefreshError(null);
                            setAnagraficaRefreshInvoiceId(invoice.id);
                          }}
                          aria-label="Aggiorna anagrafica"
                        >
                          <IdCard className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Scarica PDF">
                        <Link
                          href={`/api/invoices/${invoice.id}/pdf`}
                          target="_blank"
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon" })
                          )}
                          aria-label="Scarica PDF"
                        >
                          <FileText className="h-4 w-4" />
                        </Link>
                      </Tooltip>
                      <Tooltip content="Modifica fattura">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(invoice)}
                          aria-label="Modifica fattura"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <DeleteInvoiceButton
                        id={invoice.id}
                        nFattura={invoice.n_fattura}
                        anno={invoice.anno}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

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
                      onChange={(e) =>
                        toggleSelected(invoice.id, e.target.checked)
                      }
                      aria-label={`Seleziona fattura ${invoice.n_fattura}`}
                    />
                    <div>
                      <p className="font-medium">
                        N. {invoice.n_fattura}
                      </p>
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
                  <Tooltip content="Visualizza dettagli fattura">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenView(invoice)}
                      aria-label="Visualizza dettagli fattura"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Aggiorna layout PDF">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setRefreshError(null);
                        setRefreshInvoiceId(invoice.id);
                      }}
                      aria-label="Aggiorna layout PDF"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Aggiorna anagrafica">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setAnagraficaRefreshError(null);
                        setAnagraficaRefreshInvoiceId(invoice.id);
                      }}
                      aria-label="Aggiorna anagrafica"
                    >
                      <IdCard className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Scarica PDF">
                    <Link
                      href={`/api/invoices/${invoice.id}/pdf`}
                      target="_blank"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon" })
                      )}
                      aria-label="Scarica PDF"
                    >
                      <FileText className="h-4 w-4" />
                    </Link>
                  </Tooltip>
                  <Tooltip content="Modifica fattura">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(invoice)}
                      aria-label="Modifica fattura"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <DeleteInvoiceButton
                    id={invoice.id}
                    nFattura={invoice.n_fattura}
                    anno={invoice.anno}
                  />
                </div>
              </li>
            ))}
          </ul>

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

      <Dialog
        open={!!viewingInvoice}
        onOpenChange={(isOpen) => !isOpen && setViewingInvoice(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dettagli Fattura</DialogTitle>
            <DialogDescription>
              Visualizza i dati della fattura e delle anagrafiche collegate.
            </DialogDescription>
          </DialogHeader>
          {viewingInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">N. Fattura</p>
                  <p className="font-medium">
                    {viewingInvoice.n_fattura}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {formatDateDisplay(viewingInvoice.data)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mesi</p>
                  <p className="font-medium">
                    {viewingInvoice.mesi.map((m) => m.mese).join(", ") || "—"}
                  </p>
                  {viewingInvoice.mesi.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-sm">
                      {viewingInvoice.mesi.map((m) => (
                        <li
                          key={m.id}
                          className="flex justify-between gap-2"
                        >
                          <span className="text-muted-foreground">{m.mese}</span>
                          <span>
                            {m.prezzo.toLocaleString("it-IT", {
                              style: "currency",
                              currency: "EUR",
                            })}
                          </span>
                        </li>
                      ))}
                      <li className="mt-1 flex justify-between gap-2 border-t border-border pt-1 font-medium">
                        <span>Totale</span>
                        <span>
                          {viewingInvoice.prezzo_totale.toLocaleString("it-IT", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </span>
                      </li>
                    </ul>
                  )}
                </div>
              </div>

              {viewingInvoice.pagante && resolvedAnagrafica && (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="font-medium">Pagante</p>
                  <p>
                    {resolvedAnagrafica.pagante.cognome} {resolvedAnagrafica.pagante.nome}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {resolvedAnagrafica.pagante.via}, {resolvedAnagrafica.pagante.citta}{" "}
                    {resolvedAnagrafica.pagante.cap}
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                    <div>CF: {resolvedAnagrafica.pagante.cf ?? "-"}</div>
                    <div>P.IVA: {resolvedAnagrafica.pagante.piva ?? "-"}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewingPayer(viewingInvoice.pagante)}
                  >
                    Vedi dettagli pagante
                  </Button>
                </div>
              )}

              {viewingInvoice.paziente && resolvedAnagrafica && (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="font-medium">Paziente</p>
                  <p>
                    {resolvedAnagrafica.paziente.cognome} {resolvedAnagrafica.paziente.nome}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Usa la relazione già caricata sulla fattura, non
                      // l'elenco `patients` (filtrato sugli attivi): se il
                      // paziente è stato archiviato dopo l'emissione, non
                      // comparirebbe in quell'elenco e il bottone non
                      // aprirebbe nulla. Stesso pattern già usato sopra per
                      // "Vedi dettagli pagante" (viewingInvoice.pagante).
                      if (!viewingInvoice.paziente) return;
                      setViewingPatient({
                        ...viewingInvoice.paziente,
                        pagante: viewingInvoice.pagante,
                      });
                    }}
                  >
                    Vedi dettagli paziente
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Importo</p>
                  <p className="font-medium">
                    {getTotaleConBollo(
                      viewingInvoice.prezzo_totale,
                      viewingInvoice.bolloCodice
                    ).toLocaleString("it-IT", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Modalità</p>
                  <p className="font-medium">{viewingInvoice.mod_pag}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Marca da bollo</p>
                {viewingInvoice.bolloCodice ? (
                  <p className="font-medium">{viewingInvoice.bolloCodice}</p>
                ) : viewingInvoice.prezzo_totale > SOGLIA_BOLLO ? (
                  <p className="flex items-center gap-1.5 font-medium text-amber-600">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Dovuta, codice non ancora inserito
                  </p>
                ) : (
                  <p className="font-medium">Non dovuta</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Sedute</p>
                  <p className="font-medium">{viewingInvoice.sedute ?? "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Commento</p>
                  <p className="font-medium">{viewingInvoice.commento ?? "-"}</p>
                </div>
              </div>

              <div>
                <Link
                  href={`/api/invoices/${viewingInvoice.id}/pdf`}
                  target="_blank"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Scarica PDF
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

      <Dialog
        open={!!viewingPayer}
        onOpenChange={(isOpen) => !isOpen && setViewingPayer(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dettagli Pagante</DialogTitle>
            <DialogDescription>
              Visualizza le informazioni complete del pagante.
            </DialogDescription>
          </DialogHeader>
          {viewingPayer && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Cognome</p>
                  <p className="font-medium">{viewingPayer.cognome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{viewingPayer.nome}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Indirizzo</p>
                <p>
                  {viewingPayer.via}, {viewingPayer.citta} {viewingPayer.cap}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Codice Fiscale</p>
                  <p>{viewingPayer.cf ?? "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Partita IVA</p>
                  <p>{viewingPayer.piva ?? "-"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewingPatient}
        onOpenChange={(isOpen) => !isOpen && setViewingPatient(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dettagli Paziente</DialogTitle>
            <DialogDescription>
              Visualizza le informazioni del paziente e del pagante associato.
            </DialogDescription>
          </DialogHeader>
          {viewingPatient && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Cognome</p>
                  <p className="font-medium">{viewingPatient.cognome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{viewingPatient.nome}</p>
                </div>
              </div>

              {viewingPatient.pagante ? (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="font-medium">Pagante associato</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Cognome</p>
                      <p className="font-medium">
                        {viewingPatient.pagante.cognome}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Nome</p>
                      <p className="font-medium">
                        {viewingPatient.pagante.nome}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Indirizzo</p>
                    <p>
                      {viewingPatient.pagante.via}, {viewingPatient.pagante.citta}{" "}
                      {viewingPatient.pagante.cap}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">CF</p>
                      <p>{viewingPatient.pagante.cf ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">P.IVA</p>
                      <p>{viewingPatient.pagante.piva ?? "-"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Nessun pagante associato.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
