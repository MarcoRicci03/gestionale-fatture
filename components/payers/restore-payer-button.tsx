"use client";

import { useState, useTransition } from "react";
import { ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { restorePayer } from "@/lib/actions/payers";

type RestorePayerButtonProps = {
  id: number;
  pazientiArchiviati: number;
};

export function RestorePayerButton({
  id,
  pazientiArchiviati,
}: RestorePayerButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await restorePayer(id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  };

  const description =
    pazientiArchiviati > 0
      ? `Il pagante tornerà tra gli attivi e comparirà di nuovo negli elenchi operativi e nelle tendine. Verranno ripristinati anche ${
          pazientiArchiviati === 1
            ? "1 paziente collegato"
            : `${pazientiArchiviati} pazienti collegati`
        }.`
      : "Il pagante tornerà tra gli attivi e comparirà di nuovo negli elenchi operativi e nelle tendine.";

  return (
    <>
      <Tooltip content="Ripristina pagante">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          aria-label="Ripristina pagante"
        >
          <ArchiveRestore className="h-4 w-4" />
        </Button>
      </Tooltip>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Ripristina pagante"
        description={description}
        confirmLabel="Ripristina"
        isPending={isPending}
        onConfirm={handleConfirm}
        error={error}
      />
    </>
  );
}
