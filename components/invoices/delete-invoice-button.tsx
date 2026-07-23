"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { deleteInvoice } from "@/lib/actions/invoices";

type DeleteInvoiceButtonProps = {
  id: number;
  nFattura: number;
  anno: number;
};

export function DeleteInvoiceButton({
  id,
  nFattura,
  anno,
}: DeleteInvoiceButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const expectedText = `${nFattura}/${anno}`;

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
      <Tooltip content="Elimina fattura">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setError(null);
            setConfirmText("");
            setOpen(true);
          }}
          aria-label="Elimina fattura"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </Tooltip>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Elimina fattura"
        description="La fattura e le sue righe mensili verranno cancellate in modo irreversibile. Non sarà più possibile consultarla o ristamparla: resterà solo una voce nel registro attività."
        confirmLabel="Elimina definitivamente"
        cancelLabel="Chiudi"
        isPending={isPending}
        onConfirm={handleConfirm}
        error={error}
        confirmDisabled={confirmText.trim() !== expectedText}
      >
        <div className="space-y-1.5">
          <Label htmlFor={`delete-invoice-confirm-${id}`}>
            Digita {expectedText} per confermare
          </Label>
          <Input
            id={`delete-invoice-confirm-${id}`}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expectedText}
            autoComplete="off"
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
