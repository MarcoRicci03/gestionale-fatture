"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { deletePatient } from "@/lib/actions/patients";

export function DeletePatientButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      await deletePatient(id);
      setOpen(false);
    });
  };

  return (
    <>
      <Tooltip content="Elimina paziente">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label="Elimina paziente"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </Tooltip>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Elimina paziente"
        description="Sei sicuro di voler eliminare questo paziente? L'azione non può essere annullata."
        confirmLabel="Elimina"
        isPending={isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
