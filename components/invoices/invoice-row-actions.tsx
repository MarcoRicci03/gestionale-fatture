"use client";

import { Eye, RefreshCw, IdCard, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
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
  const isLocked = isSentToTs || isInTransmission;

  return (
    <>
      <Tooltip content="Visualizza dettagli fattura">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onView(invoice)}
          aria-label="Visualizza dettagli fattura"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Aggiorna layout PDF">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRefreshPdf(invoice)}
          aria-label="Aggiorna layout PDF"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </Tooltip>
      <Tooltip
        content={
          isInTransmission
            ? "Fattura in fase di trasmissione al Sistema TS"
            : isSentToTs
            ? "Fattura già inviata al Sistema TS (anagrafica non modificabile)"
            : "Aggiorna anagrafica"
        }
      >
        {isLocked ? (
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon"
              disabled
              aria-label={
                isInTransmission
                  ? "Fattura in fase di trasmissione al Sistema TS"
                  : "Fattura già inviata al Sistema TS (anagrafica non modificabile)"
              }
            >
              <IdCard className="h-4 w-4" />
            </Button>
          </span>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRefreshAnagrafica(invoice)}
            aria-label="Aggiorna anagrafica"
          >
            <IdCard className="h-4 w-4" />
          </Button>
        )}
      </Tooltip>
      <Tooltip content="Scarica PDF">
        <Link
          href={`/api/invoices/${invoice.id}/pdf`}
          target="_blank"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          aria-label="Scarica PDF"
        >
          <FileText className="h-4 w-4" />
        </Link>
      </Tooltip>
      <Tooltip
        content={
          isInTransmission
            ? "Fattura in fase di trasmissione al Sistema TS (non modificabile)"
            : isSentToTs
            ? "Fattura già inviata al Sistema TS (non modificabile)"
            : "Modifica fattura"
        }
      >
        {isLocked ? (
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon"
              disabled
              aria-label={
                isInTransmission
                  ? "Fattura in fase di trasmissione al Sistema TS (non modificabile)"
                  : "Fattura già inviata al Sistema TS (non modificabile)"
              }
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </span>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(invoice)}
            aria-label="Modifica fattura"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </Tooltip>
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
