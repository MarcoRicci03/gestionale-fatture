"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FatturaTsListItem } from "@/lib/data/sistema-ts";

// CR-10: sblocco di un invio con esito incerto. Sogei potrebbe aver acquisito
// il lotto; lo sblocco è sicuro solo dopo una verifica sul portale.
export type VerificaEsitoDialogProps = {
  invoice: FatturaTsListItem | null;
  onClose: () => void;
  onConfirm: (invoiceId: number) => void;
  isPending: boolean;
};

function VerificaEsitoContent({
  invoice,
  onClose,
  onConfirm,
  isPending,
}: Omit<VerificaEsitoDialogProps, "invoice"> & { invoice: FatturaTsListItem }) {
  const [verificato, setVerificato] = useState(false);
  const inviatoIl = invoice.data_invio_ts
    ? new Date(invoice.data_invio_ts).toLocaleString("it-IT", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Rome",
      })
    : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          Esito dell&apos;invio da verificare
        </DialogTitle>
        <DialogDescription>
          L&apos;invio del lotto con la fattura #{invoice.n_fattura}/{invoice.anno}
          {inviatoIl ? ` (avviato il ${inviatoIl})` : ""} si è interrotto senza una risposta certa
          dal Sistema TS.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-2 text-xs">
        <div className="rounded-lg border border-amber-500/20 bg-amber-50/60 dark:bg-amber-950/30 p-3 space-y-1 text-amber-900 dark:text-amber-200">
          <p className="font-semibold">Prima di sbloccare:</p>
          <p>• Accedi al portale Sistema TS e controlla gli invii di quel giorno e di quell&apos;orario.</p>
          <p>
            • Se il lotto <strong>risulta acquisito</strong>, NON sbloccare: un reinvio creerebbe un
            duplicato. Annota il protocollo e contatta l&apos;assistenza.
          </p>
          <p>
            • Se il lotto <strong>non risulta</strong>, puoi sbloccarlo: tutte le fatture dello
            stesso invio tornano &ldquo;Da inviare&rdquo;.
          </p>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={verificato}
            onChange={(e) => setVerificato(e.target.checked)}
            disabled={isPending}
            className="h-4 w-4 mt-0.5 rounded border-input text-primary focus:ring-primary"
          />
          <span className="text-foreground">
            Ho verificato sul portale Sistema TS che il lotto non risulta acquisito.
          </span>
        </label>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Indietro
        </Button>
        <Button
          onClick={() => {
            if (verificato) onConfirm(invoice.id);
          }}
          disabled={isPending || !verificato}
        >
          {isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Sblocco in corso...
            </>
          ) : (
            <>
              <RotateCcw className="mr-2 h-4 w-4" />
              Sblocca il lotto
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

export function VerificaEsitoDialog({
  invoice,
  onClose,
  onConfirm,
  isPending,
}: VerificaEsitoDialogProps) {
  return (
    <Dialog open={!!invoice} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {invoice && (
          <VerificaEsitoContent
            key={invoice.id}
            invoice={invoice}
            onClose={onClose}
            onConfirm={onConfirm}
            isPending={isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
