"use client";

import { useState, useTransition } from "react";
import { ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { restorePatient } from "@/lib/actions/patients";

export function RestorePatientButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await restorePatient(id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        title="Ripristina paziente"
        aria-label="Ripristina paziente"
      >
        <ArchiveRestore className="h-4 w-4" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Ripristina paziente"
        description="Il paziente tornerà tra gli attivi e comparirà di nuovo negli elenchi operativi e nelle tendine."
        confirmLabel="Ripristina"
        isPending={isPending}
        onConfirm={handleConfirm}
        error={error}
      />
    </>
  );
}
