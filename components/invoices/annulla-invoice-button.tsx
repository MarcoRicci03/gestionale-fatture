"use client";

import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { deleteInvoice } from "@/lib/actions/invoices";

export function AnnullaInvoiceButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await deleteInvoice(id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  };

  return (
    <>
      <Tooltip content="Annulla fattura">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          aria-label="Annulla fattura"
        >
          <Ban className="h-4 w-4 text-destructive" />
        </Button>
      </Tooltip>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Annulla fattura"
        description="La fattura resterà nell'archivio, consultabile e ristampabile, ma marcata come annullata ed esclusa dai totali. Il suo numero non potrà mai essere riassegnato a un'altra fattura."
        confirmLabel="Annulla fattura"
        isPending={isPending}
        onConfirm={handleConfirm}
        error={error}
      />
    </>
  );
}
