"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  // Errore restituito dalla server action (es. conflitto di ripristino,
  // fatture collegate): mostrato dentro il dialog, che resta aperto finché
  // l'utente non annulla o corregge il problema altrove.
  error?: string | null;
  // Contenuto extra reso tra la description e il blocco errore (es. il campo
  // di conferma testuale di DeleteInvoiceButton).
  children?: ReactNode;
  // Si somma a isPending nel disabled del bottone di conferma: usato per
  // tenere il bottone disabilitato finché una conferma testuale non è stata
  // digitata correttamente.
  confirmDisabled?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  isPending,
  onConfirm,
  error,
  children,
  confirmDisabled,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        {children}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending || confirmDisabled}
          >
            {isPending ? "Elaborazione..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
