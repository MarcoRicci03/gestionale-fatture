"use client";

import { useState, useTransition } from "react";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { archivePatient } from "@/lib/actions/patients";

export function ArchivePatientButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await archivePatient(id);
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
        title="Archivia paziente"
        aria-label="Archivia paziente"
      >
        <Archive className="h-4 w-4 text-destructive" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Archivia paziente"
        description="Il paziente sarà spostato tra gli archiviati e non comparirà negli elenchi operativi né nelle tendine. Le sue fatture restano visibili e conteggiate. Potrai ripristinarlo in qualsiasi momento."
        confirmLabel="Archivia"
        isPending={isPending}
        onConfirm={handleConfirm}
        error={error}
      />
    </>
  );
}
