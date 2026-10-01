"use client";

import { useState, useMemo } from "react";
import { Ban, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { maskDateInput } from "@/lib/utils/date";
import { formatDate, type CancelInvoiceData } from "../types";

export type CancelInvoiceTsDialogProps = {
  cancellingInvoice: CancelInvoiceData | null;
  onClose: () => void;
  onConfirm: (invoiceId: number, confermaEsitoVerificato: boolean) => void;
  isPending: boolean;
};

type CancelInvoiceFormContentProps = {
  cancellingInvoice: CancelInvoiceData;
  onClose: () => void;
  onConfirm: (invoiceId: number, confermaEsitoVerificato: boolean) => void;
  isPending: boolean;
};

function CancelInvoiceFormContent({
  cancellingInvoice,
  onClose,
  onConfirm,
  isPending,
}: CancelInvoiceFormContentProps) {
  const [cancelConfirmNumero, setCancelConfirmNumero] = useState("");
  const [cancelConfirmData, setCancelConfirmData] = useState("");
  const [cancelConfirmIntestatario, setCancelConfirmIntestatario] = useState("");
  // P005: con un annullamento precedente dall'esito incerto serve anche la
  // conferma della verifica sul portale.
  const [esitoVerificato, setEsitoVerificato] = useState(false);
  const richiedeVerificaEsito = cancellingInvoice.esitoDaVerificare === true;

  const isCancelNumeroValid = useMemo(() => {
    const clean = cancelConfirmNumero.trim().replace(/^#/, "").trim();
    if (!clean) return false;
    return (
      clean === String(cancellingInvoice.n_fattura) ||
      clean === `${cancellingInvoice.n_fattura}/${cancellingInvoice.anno}` ||
      clean === `${cancellingInvoice.n_fattura}-${cancellingInvoice.anno}`
    );
  }, [cancellingInvoice, cancelConfirmNumero]);

  const isCancelDataValid = useMemo(() => {
    const trimmed = cancelConfirmData.trim();
    if (!trimmed) return false;

    const formattedExpected = formatDate(cancellingInvoice.data);
    if (trimmed === formattedExpected) return true;

    const [expDayStr, expMonthStr, expYearStr] = formattedExpected.split("/");
    const expDay = parseInt(expDayStr, 10);
    const expMonth = parseInt(expMonthStr, 10);
    const expYear = parseInt(expYearStr, 10);

    const dmy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) {
      const d = parseInt(dmy[1], 10);
      const m = parseInt(dmy[2], 10);
      const y = parseInt(dmy[3], 10);
      if (d === expDay && m === expMonth && y === expYear) return true;
    }

    const ymd = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (ymd) {
      const y = parseInt(ymd[1], 10);
      const m = parseInt(ymd[2], 10);
      const d = parseInt(ymd[3], 10);
      if (d === expDay && m === expMonth && y === expYear) return true;
    }

    return false;
  }, [cancellingInvoice, cancelConfirmData]);

  const isCancelIntestatarioValid = useMemo(() => {
    const clean = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const inputWords = clean(cancelConfirmIntestatario);
    const targetWords = clean(cancellingInvoice.paganteNome);

    if (inputWords.length === 0 || targetWords.length === 0) return false;
    if (inputWords.length !== targetWords.length) return false;

    const sortedInput = [...inputWords].sort().join(" ");
    const sortedTarget = [...targetWords].sort().join(" ");
    return sortedInput === sortedTarget;
  }, [cancellingInvoice, cancelConfirmIntestatario]);

  const isCancelConfirmationValid =
    isCancelNumeroValid &&
    isCancelDataValid &&
    isCancelIntestatarioValid &&
    (!richiedeVerificaEsito || esitoVerificato);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-destructive">
          <Ban className="h-5 w-5" />
          Annullamento Spesa su Sistema TS
        </DialogTitle>
        <DialogDescription>
          Stai per inviare una richiesta ufficiale di cancellazione (operazione &apos;C&apos;)
          per la fattura #{cancellingInvoice.n_fattura}/{cancellingInvoice.anno} ai server di Sogei / MEF.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2 text-xs">
        {richiedeVerificaEsito && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-50/60 dark:bg-amber-950/30 p-3 space-y-2 text-amber-900 dark:text-amber-200">
            <p className="font-semibold">Esito del precedente annullamento incerto</p>
            <p>
              Il Sistema TS potrebbe aver già ricevuto la richiesta. Controlla sul portale: se
              l&apos;annullamento <strong>risulta acquisito</strong>, NON ripeterlo e contatta
              l&apos;assistenza.
            </p>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={esitoVerificato}
                onChange={(e) => setEsitoVerificato(e.target.checked)}
                disabled={isPending}
                className="h-4 w-4 mt-0.5 rounded border-input text-primary focus:ring-primary"
              />
              <span className="text-foreground">
                Ho verificato sul portale Sistema TS che il precedente annullamento non risulta acquisito.
              </span>
            </label>
          </div>
        )}

        <div className="rounded-lg bg-destructive/10 p-3 text-destructive border border-destructive/20 space-y-1">
          <p className="font-semibold">Cosa comporta questa operazione:</p>
          <p>• La spesa sanitaria verrà <strong>eliminata dal 730 precompilato</strong> dell&apos;assistito.</p>
          <p>• Verrà rilasciato da Sogei un Protocollo di Cancellazione ufficiale.</p>
          <p>• La fattura rimarrà nel gestionale con stato &ldquo;Annullata su TS&rdquo;.</p>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
          <p className="font-medium text-foreground text-xs">
            Per confermare ed evitare cancellazioni accidentali, digita i seguenti dati di verifica della fattura:
          </p>

          {/* Numero fattura */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="cancel-numero" className="text-xs">
                Numero fattura
              </Label>
              {cancelConfirmNumero.trim() && (
                isCancelNumeroValid ? (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Corretto
                  </span>
                ) : (
                  <span className="text-[11px] text-destructive flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Non corrisponde
                  </span>
                )
              )}
            </div>
            <Input
              id="cancel-numero"
              value={cancelConfirmNumero}
              onChange={(e) => setCancelConfirmNumero(e.target.value)}
              placeholder={String(cancellingInvoice.n_fattura)}
              className="h-8 text-xs bg-background"
              disabled={isPending}
            />
          </div>

          {/* Data emissione */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="cancel-data" className="text-xs">
                Data emissione <span className="text-muted-foreground font-normal">(GG/MM/AAAA)</span>
              </Label>
              {cancelConfirmData.trim() && (
                isCancelDataValid ? (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Corretto
                  </span>
                ) : (
                  <span className="text-[11px] text-destructive flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Non corrisponde
                  </span>
                )
              )}
            </div>
            <Input
              id="cancel-data"
              value={cancelConfirmData}
              onChange={(e) =>
                setCancelConfirmData(
                  maskDateInput(e.target.value, cancelConfirmData)
                )
              }
              placeholder={formatDate(cancellingInvoice.data)}
              maxLength={10}
              className="h-8 text-xs bg-background"
              disabled={isPending}
            />
          </div>

          {/* Intestatario */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="cancel-intestatario" className="text-xs">
                Intestatario fattura <span className="text-muted-foreground font-normal">(nome e cognome)</span>
              </Label>
              {cancelConfirmIntestatario.trim() && (
                isCancelIntestatarioValid ? (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Corretto
                  </span>
                ) : (
                  <span className="text-[11px] text-destructive flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Non corrisponde
                  </span>
                )
              )}
            </div>
            <Input
              id="cancel-intestatario"
              value={cancelConfirmIntestatario}
              onChange={(e) => setCancelConfirmIntestatario(e.target.value)}
              placeholder={cancellingInvoice.paganteNome ?? ""}
              className="h-8 text-xs bg-background"
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          Indietro
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            if (isCancelConfirmationValid) {
              onConfirm(cancellingInvoice.id, richiedeVerificaEsito && esitoVerificato);
            }
          }}
          disabled={isPending || !isCancelConfirmationValid}
        >
          {isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Cancellazione in corso...
            </>
          ) : (
            "Conferma Cancellazione"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CancelInvoiceTsDialog({
  cancellingInvoice,
  onClose,
  onConfirm,
  isPending,
}: CancelInvoiceTsDialogProps) {
  return (
    <Dialog
      open={!!cancellingInvoice}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        {cancellingInvoice && (
          <CancelInvoiceFormContent
            key={cancellingInvoice.id}
            cancellingInvoice={cancellingInvoice}
            onClose={onClose}
            onConfirm={onConfirm}
            isPending={isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
