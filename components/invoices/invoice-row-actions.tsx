"use client";

import { Eye, RefreshCw, IdCard, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeleteInvoiceButton } from "./delete-invoice-button";
import type { InvoiceListItem } from "./types";

type InvoiceRowActionsProps = {
  invoice: InvoiceListItem;
  onView: (invoice: InvoiceListItem) => void;
  onRefreshPdf: (invoice: InvoiceListItem) => void;
  onRefreshAnagrafica: (invoice: InvoiceListItem) => void;
  onEdit: (invoice: InvoiceListItem) => void;
};

export function InvoiceRowActions({
  invoice,
  onView,
  onRefreshPdf,
  onRefreshAnagrafica,
  onEdit,
}: InvoiceRowActionsProps) {
  const isSentToTs =
    invoice.stato_ts === "INVIATA" ||
    invoice.stato_ts === "DA_CANCELLARE_SU_TS";
  const isInTransmission = invoice.stato_ts === "IN_TRASMISSIONE";
  const isCancelledOnTs = invoice.stato_ts === "ANNULLATA_TS";
  const isLocked = isSentToTs || isInTransmission || isCancelledOnTs;

  const anagraficaLabel = isInTransmission
    ? "Fattura in fase di trasmissione al Sistema TS"
    : isSentToTs
    ? "Fattura già inviata al Sistema TS (anagrafica non modificabile)"
    : isCancelledOnTs
    ? "Fattura annullata su Sistema TS: ripristinala prima dalla sezione Sistema TS per aggiornare l'anagrafica"
    : "Aggiorna anagrafica";

  const editLabel = isInTransmission
    ? "Fattura in fase di trasmissione al Sistema TS (non modificabile)"
    : isSentToTs
    ? "Fattura già inviata al Sistema TS (non modificabile)"
    : isCancelledOnTs
    ? "Fattura annullata su Sistema TS: ripristinala prima dalla sezione Sistema TS per modificarla"
    : "Modifica fattura";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onView(invoice)}
        title="Visualizza dettagli fattura"
        aria-label="Visualizza dettagli fattura"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRefreshPdf(invoice)}
        title="Aggiorna layout PDF"
        aria-label="Aggiorna layout PDF"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      {isLocked ? (
        <span className="inline-flex" title={anagraficaLabel}>
          <Button
            variant="ghost"
            size="icon"
            disabled
            title={anagraficaLabel}
            aria-label={anagraficaLabel}
          >
            <IdCard className="h-4 w-4" />
          </Button>
        </span>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRefreshAnagrafica(invoice)}
          title={anagraficaLabel}
          aria-label={anagraficaLabel}
        >
          <IdCard className="h-4 w-4" />
        </Button>
      )}
      <Link
        href={`/api/invoices/${invoice.id}/pdf`}
        target="_blank"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
        title="Scarica PDF"
        aria-label="Scarica PDF"
      >
        <FileText className="h-4 w-4" />
      </Link>
      {isLocked ? (
        <span className="inline-flex" title={editLabel}>
          <Button
            variant="ghost"
            size="icon"
            disabled
            title={editLabel}
            aria-label={editLabel}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </span>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(invoice)}
          title={editLabel}
          aria-label={editLabel}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      <DeleteInvoiceButton
        id={invoice.id}
        nFattura={invoice.n_fattura}
        anno={invoice.anno}
        statoTs={invoice.stato_ts}
        protocolloTs={invoice.protocollo_ts}
      />
    </>
  );
}
