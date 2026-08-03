"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Pagante, Paziente } from "@prisma/client";

type PatientDetailDialogProps = {
  patient: (Paziente & { pagante: Pagante | null }) | null;
  onOpenChange: (open: boolean) => void;
};

export function PatientDetailDialog({
  patient,
  onOpenChange,
}: PatientDetailDialogProps) {
  return (
    <Dialog open={!!patient} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dettagli Paziente</DialogTitle>
          <DialogDescription>
            Visualizza le informazioni del paziente e del pagante associato.
          </DialogDescription>
        </DialogHeader>
        {patient && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Cognome</p>
                <p className="font-medium">{patient.cognome}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{patient.nome}</p>
              </div>
            </div>

            {patient.pagante ? (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="font-medium">Pagante associato</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Cognome</p>
                    <p className="font-medium">
                      {patient.pagante.cognome}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">
                      {patient.pagante.nome}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Indirizzo</p>
                  <p>
                    {patient.pagante.via}, {patient.pagante.citta}{" "}
                    {patient.pagante.cap}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">CF</p>
                    <p>{patient.pagante.cf ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">P.IVA</p>
                    <p>{patient.pagante.piva ?? "-"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Nessun pagante associato.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
