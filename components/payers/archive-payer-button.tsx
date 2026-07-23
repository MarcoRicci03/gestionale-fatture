"use client";

import { useState, useTransition } from "react";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { archivePayer } from "@/lib/actions/payers";

type ArchivePayerButtonProps = {
  id: number;
  pazienti: { id: number; nome: string; cognome: string }[];
};

export function ArchivePayerButton({ id, pazienti }: ArchivePayerButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await archivePayer(id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  };

  const hasPazienti = pazienti.length > 0;
  const description = hasPazienti
    ? "Il pagante sarà spostato tra gli archiviati e non comparirà negli elenchi operativi né nelle tendine. Le sue fatture restano visibili e conteggiate. Verranno archiviati anche i pazienti collegati, che potrai ripristinare insieme al pagante."
    : "Il pagante sarà spostato tra gli archiviati e non comparirà negli elenchi operativi né nelle tendine. Le sue fatture restano visibili e conteggiate. Potrai ripristinarlo in qualsiasi momento.";

  return (
    <>
      <Tooltip content="Archivia pagante">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          aria-label="Archivia pagante"
        >
          <Archive className="h-4 w-4 text-destructive" />
        </Button>
      </Tooltip>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Archivia pagante"
        description={description}
        confirmLabel="Archivia"
        isPending={isPending}
        onConfirm={handleConfirm}
        error={error}
      >
        {hasPazienti && (
          <div className="rounded-md border p-3 text-sm space-y-2">
            <p>
              Verranno archiviati anche{" "}
              {pazienti.length === 1
                ? "1 paziente collegato"
                : `${pazienti.length} pazienti collegati`}
              :
            </p>
            <ul className="list-disc space-y-1 pl-4">
              {pazienti.map((p) => (
                <li key={p.id}>
                  {p.cognome} {p.nome}
                </li>
              ))}
            </ul>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
