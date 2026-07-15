"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { deleteInvoice } from "@/lib/actions/invoices";

export function DeleteInvoiceButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      await deleteInvoice(id);
      setOpen(false);
    });
  };

  return (
    <>
      <Tooltip content="Elimina fattura">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label="Elimina fattura"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </Tooltip>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Elimina fattura"
        description="Sei sicuro di voler eliminare questa fattura? L'azione non può essere annullata."
        confirmLabel="Elimina"
        isPending={isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
