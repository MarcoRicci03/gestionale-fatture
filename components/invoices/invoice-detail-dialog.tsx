"use client";

import { AlertTriangle, FileText } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SOGLIA_BOLLO } from "@/lib/constants/bollo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDateDisplay } from "@/lib/utils/date";
import { resolveAnagrafica } from "@/lib/invoices/anagrafica-snapshot";
import { getTotaleConBollo } from "@/lib/invoices/bollo-total";
import type { Pagante, Paziente } from "@prisma/client";
import type { InvoiceWithRelations } from "./invoices-manager";

type InvoiceDetailDialogProps = {
  invoice: InvoiceWithRelations | null;
  onOpenChange: (open: boolean) => void;
  onViewPayer: (pagante: Pagante) => void;
  onViewPatient: (patient: Paziente & { pagante: Pagante | null }) => void;
};

export function InvoiceDetailDialog({
  invoice,
  onOpenChange,
  onViewPayer,
  onViewPatient,
}: InvoiceDetailDialogProps) {
  const resolvedAnagrafica = invoice?.pagante && invoice?.paziente
    ? resolveAnagrafica({
        snapshotAnagrafica: invoice.snapshotAnagrafica,
        pagante: invoice.pagante,
        paziente: invoice.paziente,
      })
    : null;

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dettagli Fattura</DialogTitle>
          <DialogDescription>
            Visualizza i dati della fattura e delle anagrafiche collegate.
          </DialogDescription>
        </DialogHeader>
        {invoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">N. Fattura</p>
                <p className="font-medium">
                  {invoice.n_fattura}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data</p>
                <p className="font-medium">
                  {formatDateDisplay(invoice.data)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mesi</p>
                <p className="font-medium">
                  {invoice.mesi.map((m) => m.mese).join(", ") || "—"}
                </p>
                {invoice.mesi.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {invoice.mesi.map((m) => (
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
                        {invoice.prezzo_totale.toLocaleString("it-IT", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    </li>
                  </ul>
                )}
              </div>
            </div>

            {invoice.pagante && resolvedAnagrafica && (
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
                  onClick={() => onViewPayer(invoice.pagante!)}
                >
                  Vedi dettagli pagante
                </Button>
              </div>
            )}

            {invoice.paziente && resolvedAnagrafica && (
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
                    // "Vedi dettagli pagante" (invoice.pagante). Per questo
                    // questo componente non riceve affatto una prop
                    // `patients`: non deve poter guardare altrove.
                    if (!invoice.paziente) return;
                    onViewPatient({
                      ...invoice.paziente,
                      pagante: invoice.pagante,
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
                    invoice.prezzo_totale,
                    invoice.bolloCodice
                  ).toLocaleString("it-IT", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Modalità</p>
                <p className="font-medium">{invoice.mod_pag}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Marca da bollo</p>
              {invoice.bolloCodice ? (
                <p className="font-medium">{invoice.bolloCodice}</p>
              ) : invoice.prezzo_totale > SOGLIA_BOLLO ? (
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
                <p className="font-medium">{invoice.sedute ?? "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Commento</p>
                <p className="font-medium">{invoice.commento ?? "-"}</p>
              </div>
            </div>

            <div>
              <Link
                href={`/api/invoices/${invoice.id}/pdf`}
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
  );
}
