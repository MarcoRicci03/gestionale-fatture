"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { hardDeletePatient } from "@/lib/actions/patients";

type HardDeletePatientButtonProps = {
  id: number;
  // Motivo per cui l'eliminazione definitiva è bloccata (fatture collegate).
  // Se assente/null il bottone è abilitato.
  disabledReason?: string | null;
};

export function HardDeletePatientButton({
  id,
  disabledReason,
}: HardDeletePatientButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const disabled = !!disabledReason;

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await hardDeletePatient(id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  };

  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={() => {
        setError(null);
        setOpen(true);
      }}
      aria-label="Elimina definitivamente paziente"
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );

  return (
    <>
      <Tooltip
        content={disabled ? disabledReason : "Elimina definitivamente paziente"}
      >
        {disabled ? <span className="inline-flex">{triggerButton}</span> : triggerButton}
      </Tooltip>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Elimina definitivamente paziente"
        description="Azione irreversibile. Il paziente non ha fatture collegate: verrà eliminato definitivamente."
        confirmLabel="Elimina definitivamente"
        isPending={isPending}
        onConfirm={handleConfirm}
        error={error}
      />
    </>
  );
}
