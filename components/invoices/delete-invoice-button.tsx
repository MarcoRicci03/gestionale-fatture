"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { deleteInvoice } from "@/lib/actions/invoices";

type DeleteInvoiceButtonProps = {
  id: number;
  nFattura: number;
  anno: number;
  statoTs?: string;
  protocolloTs?: string | null;
};

export function DeleteInvoiceButton({
  id,
  nFattura,
  anno,
  statoTs,
  protocolloTs,
}: DeleteInvoiceButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const isSentToTs = statoTs === "INVIATA" || statoTs === "DA_CANCELLARE_SU_TS";
  const isInTransmission = statoTs === "IN_TRASMISSIONE";
  const isCancelledOnTs = statoTs === "ANNULLATA_TS";
  const expectedText = `${nFattura}/${anno}`;

  const disabledTooltip = isInTransmission
    ? "Fattura in fase di trasmissione al Sistema TS (non eliminabile)"
    : isCancelledOnTs
    ? "Fattura annullata su Sistema TS (non eliminabile)"
    : null;

  const deleteTitle = isSentToTs ? "Annulla fattura su Sistema TS" : "Elimina fattura";

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
      {disabledTooltip ? (
        <span className="inline-flex" title={disabledTooltip}>
          <Button
            variant="ghost"
            size="icon"
            disabled
            title={disabledTooltip}
            aria-label={disabledTooltip}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </span>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setError(null);
            setConfirmText("");
            setOpen(true);
          }}
          title={deleteTitle}
          aria-label={deleteTitle}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={isSentToTs ? "Annulla fattura su Sistema TS" : "Elimina fattura"}
        description={
          isSentToTs
            ? `La fattura è già stata inviata al Sistema Tessera Sanitaria (Protocollo: ${protocolloTs ?? "registrato"}). Confermandone l'eliminazione, verrà inviata una richiesta telematica sincrona di annullamento (flagOperazione = 'C') al Ministero delle Finanze. Nel gestionale la fattura verrà contrassegnata come ANNULLATA.`
            : "La fattura e le sue righe mensili verranno cancellate in modo irreversibile. Non sarà più possibile consultarla o ristamparla: resterà solo una voce nel registro attività."
        }
        confirmLabel={isSentToTs ? "Conferma annullamento TS" : "Elimina definitivamente"}
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
