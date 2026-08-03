"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Pagante } from "@prisma/client";

type PayerDetailDialogProps = {
  payer: Pagante | null;
  onOpenChange: (open: boolean) => void;
};

export function PayerDetailDialog({ payer, onOpenChange }: PayerDetailDialogProps) {
  return (
    <Dialog open={!!payer} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dettagli Pagante</DialogTitle>
          <DialogDescription>
            Visualizza le informazioni complete del pagante.
          </DialogDescription>
        </DialogHeader>
        {payer && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Cognome</p>
                <p className="font-medium">{payer.cognome}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{payer.nome}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Indirizzo</p>
              <p>
                {payer.via}, {payer.citta} {payer.cap}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Codice Fiscale</p>
                <p>{payer.cf ?? "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Partita IVA</p>
                <p>{payer.piva ?? "-"}</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
