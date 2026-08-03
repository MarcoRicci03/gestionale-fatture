"use client";

import { Eye, RefreshCw, IdCard, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { DeleteInvoiceButton } from "./delete-invoice-button";
import type { InvoiceWithRelations } from "./invoices-manager";

type InvoiceRowActionsProps = {
  invoice: InvoiceWithRelations;
  onView: (invoice: InvoiceWithRelations) => void;
  onRefreshPdf: (invoice: InvoiceWithRelations) => void;
  onRefreshAnagrafica: (invoice: InvoiceWithRelations) => void;
  onEdit: (invoice: InvoiceWithRelations) => void;
};

export function InvoiceRowActions({
  invoice,
  onView,
  onRefreshPdf,
  onRefreshAnagrafica,
  onEdit,
}: InvoiceRowActionsProps) {
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
      <Tooltip content="Aggiorna anagrafica">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRefreshAnagrafica(invoice)}
          aria-label="Aggiorna anagrafica"
        >
          <IdCard className="h-4 w-4" />
        </Button>
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
      <Tooltip content="Modifica fattura">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(invoice)}
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
    </>
  );
}
