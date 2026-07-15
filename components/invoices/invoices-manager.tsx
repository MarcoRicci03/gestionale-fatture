"use client";

import { useState } from "react";
import { PlusCircle, Pencil, FileText, Eye } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { formatDateDisplay } from "@/lib/utils/date";
import type { FatturaMese, Pagamento, Pagante, Paziente } from "@prisma/client";

type InvoiceWithRelations = Pagamento & {
  mesi: FatturaMese[];
  pagante: Pagante | null;
  paziente: Paziente | null;
};

type InvoicesManagerProps = {
  invoices: InvoiceWithRelations[];
  payers: Pagante[];
  patients: (Paziente & { pagante: Pagante | null })[];
  nextInvoiceNumber: number;
};

export function InvoicesManager({
  invoices,
  payers,
  patients,
  nextInvoiceNumber,
}: InvoicesManagerProps) {
  const [open, setOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithRelations | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceWithRelations | null>(null);
  const [viewingPayer, setViewingPayer] = useState<Pagante | null>(null);
  const [viewingPatient, setViewingPatient] = useState<
    (Paziente & { pagante: Pagante | null }) | null
  >(null);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fatture</h1>
          <p className="text-muted-foreground">Gestione fatture e pagamenti</p>
        </div>
        <Button onClick={handleOpenNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuova fattura
        </Button>
      </div>

      {invoices.length === 0 ? (
        <p className="text-muted-foreground">Nessuna fattura emessa.</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
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
                    {invoice.prezzo_totale.toLocaleString("it-IT", {
                      style: "currency",
                      currency: "EUR",
                    })}
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
                    <DeleteInvoiceButton id={invoice.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">N. Fattura</p>
                  <p className="font-medium">{viewingInvoice.n_fattura}</p>
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
                </div>
              </div>

              {viewingInvoice.pagante && (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="font-medium">Pagante</p>
                  <p>
                    {viewingInvoice.pagante.cognome} {viewingInvoice.pagante.nome}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {viewingInvoice.pagante.via}, {viewingInvoice.pagante.citta}{" "}
                    {viewingInvoice.pagante.cap}
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>CF: {viewingInvoice.pagante.cf ?? "-"}</div>
                    <div>P.IVA: {viewingInvoice.pagante.piva ?? "-"}</div>
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

              {viewingInvoice.paziente && (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="font-medium">Paziente</p>
                  <p>
                    {viewingInvoice.paziente.cognome} {viewingInvoice.paziente.nome}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const patient = patients.find(
                        (p) => p.id === viewingInvoice.paziente!.id
                      );
                      if (patient) setViewingPatient(patient);
                    }}
                  >
                    Vedi dettagli paziente
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Importo</p>
                  <p className="font-medium">
                    {viewingInvoice.prezzo_totale.toLocaleString("it-IT", {
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

              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
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
