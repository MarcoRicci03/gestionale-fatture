"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { hardDeletePayer } from "@/lib/actions/payers";

type HardDeletePayerButtonProps = {
  id: number;
  // Motivo per cui l'eliminazione definitiva è bloccata (fatture collegate o
  // pazienti non ancora archiviati). Se assente/null il bottone è abilitato.
  disabledReason?: string | null;
};

export function HardDeletePayerButton({
  id,
  disabledReason,
}: HardDeletePayerButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const disabled = !!disabledReason;

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await hardDeletePayer(id);
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
      aria-label="Elimina definitivamente pagante"
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );

  return (
    <>
      <Tooltip
        content={disabled ? disabledReason : "Elimina definitivamente pagante"}
      >
        {/* Un pulsante disabled riceve pointer-events:none (button.tsx): il
            wrapper mantiene il tooltip raggiungibile anche in quel caso. */}
        {disabled ? <span className="inline-flex">{triggerButton}</span> : triggerButton}
      </Tooltip>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Elimina definitivamente pagante"
        description="Azione irreversibile. Il pagante non ha fatture né pazienti collegati non archiviati: verrà eliminato definitivamente insieme agli eventuali pazienti già archiviati e senza fatture."
        confirmLabel="Elimina definitivamente"
        isPending={isPending}
        onConfirm={handleConfirm}
        error={error}
      />
    </>
  );
}
