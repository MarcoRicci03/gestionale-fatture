"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { deletePayer } from "@/lib/actions/payers";

export function DeletePayerButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      await deletePayer(id);
      setOpen(false);
    });
  };

  return (
    <>
      <Tooltip content="Elimina pagante">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label="Elimina pagante"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </Tooltip>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Elimina pagante"
        description="Sei sicuro di voler eliminare questo pagante? L'azione non può essere annullata."
        confirmLabel="Elimina"
        isPending={isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
