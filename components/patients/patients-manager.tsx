"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PatientForm } from "./patient-form";
import { DeletePatientButton } from "./delete-patient-button";
import { Tooltip } from "@/components/ui/tooltip";
import type { Paziente, Pagante } from "@prisma/client";

type PatientsManagerProps = {
  patients: (Paziente & { pagante: Pagante | null })[];
  payers: Pagante[];
};

export function PatientsManager({ patients, payers }: PatientsManagerProps) {
  const [open, setOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<
    (Paziente & { pagante: Pagante | null }) | null
  >(null);
  const [viewingPatient, setViewingPatient] = useState<
    (Paziente & { pagante: Pagante | null }) | null
  >(null);
  const [viewingPayer, setViewingPayer] = useState<Pagante | null>(null);

  const handleOpenNew = () => {
    setEditingPatient(null);
    setOpen(true);
  };

  const handleOpenEdit = (
    patient: Paziente & { pagante: Pagante | null }
  ) => {
    setEditingPatient(patient);
    setOpen(true);
  };

  const handleOpenView = (
    patient: Paziente & { pagante: Pagante | null }
  ) => {
    setViewingPatient(patient);
  };

  const handleSuccess = () => {
    setOpen(false);
    setEditingPatient(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pazienti</h1>
          <p className="text-muted-foreground">Gestione anagrafica pazienti</p>
        </div>
        <Button onClick={handleOpenNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuovo paziente
        </Button>
      </div>

      {patients.length === 0 ? (
        <p className="text-muted-foreground">Nessun paziente registrato.</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cognome</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Pagante</TableHead>
                <TableHead className="w-24 text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium">
                    {patient.cognome}
                  </TableCell>
                  <TableCell>{patient.nome}</TableCell>
                  <TableCell>
                    {patient.pagante
                      ? `${patient.pagante.cognome} ${patient.pagante.nome}`
                      : "-"}
                  </TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Tooltip content="Visualizza dettagli paziente">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenView(patient)}
                        aria-label="Visualizza dettagli paziente"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Modifica paziente">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(patient)}
                        aria-label="Modifica paziente"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <DeletePatientButton id={patient.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPatient ? "Modifica Paziente" : "Nuovo Paziente"}
            </DialogTitle>
          </DialogHeader>
          <PatientForm
            patient={editingPatient ?? undefined}
            payers={payers}
            onSuccess={handleSuccess}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewingPatient}
        onOpenChange={(isOpen) => !isOpen && setViewingPatient(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dettagli Paziente</DialogTitle>
            <DialogDescription>
              Visualizza le informazioni del paziente e del pagante associato.
            </DialogDescription>
          </DialogHeader>
          {viewingPatient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cognome</p>
                  <p className="font-medium">{viewingPatient.cognome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{viewingPatient.nome}</p>
                </div>
              </div>

              {viewingPatient.pagante ? (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="font-medium">Pagante associato</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Cognome</p>
                      <p className="font-medium">
                        {viewingPatient.pagante.cognome}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Nome</p>
                      <p className="font-medium">
                        {viewingPatient.pagante.nome}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Indirizzo</p>
                    <p>
                      {viewingPatient.pagante.via}, {viewingPatient.pagante.citta}{" "}
                      {viewingPatient.pagante.cap}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">CF</p>
                      <p>{viewingPatient.pagante.cf ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">P.IVA</p>
                      <p>{viewingPatient.pagante.piva ?? "-"}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewingPayer(viewingPatient.pagante)}
                  >
                    Vedi dettagli pagante
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Nessun pagante associato.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewingPayer}
        onOpenChange={(isOpen) => !isOpen && setViewingPayer(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dettagli Pagante</DialogTitle>
            <DialogDescription>
              Visualizza le informazioni complete del pagante associato.
            </DialogDescription>
          </DialogHeader>
          {viewingPayer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cognome</p>
                  <p className="font-medium">{viewingPayer.cognome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{viewingPayer.nome}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Indirizzo</p>
                <p>
                  {viewingPayer.via}, {viewingPayer.citta} {viewingPayer.cap}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Codice Fiscale</p>
                  <p>{viewingPayer.cf ?? "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Partita IVA</p>
                  <p>{viewingPayer.piva ?? "-"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
