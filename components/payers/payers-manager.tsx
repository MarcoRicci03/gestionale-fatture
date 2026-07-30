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
import { PayerForm } from "./payer-form";
import { ArchivePayerButton } from "./archive-payer-button";
import { RestorePayerButton } from "./restore-payer-button";
import { HardDeletePayerButton } from "./hard-delete-payer-button";
import { Tooltip } from "@/components/ui/tooltip";
import type { Pagante, Paziente } from "@prisma/client";
import type { ArchivedPayerRow } from "@/lib/data/payers";

type ActivePayer = Pagante & { pazienti: Paziente[] };

type PayersManagerProps = {
  payers: ActivePayer[];
  archivedPayers: ArchivedPayerRow[];
};

function formatCurrency(amount: number) {
  return amount.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
}

function invoiceImpactLabel(row: ArchivedPayerRow): string | null {
  if (row.fattureCount === 0) return null;
  const years =
    row.fatturaAnnoMin === row.fatturaAnnoMax
      ? `${row.fatturaAnnoMin}`
      : `${row.fatturaAnnoMin}-${row.fatturaAnnoMax}`;
  const plural = row.fattureCount === 1 ? "" : "e";
  return `${row.fattureCount} fattura${plural} collegata${plural} (${years}, ${formatCurrency(row.fattureTotale)})`;
}

function hardDeleteBlockReason(row: ArchivedPayerRow): string | null {
  if (row.fattureCount > 0) {
    const plural = row.fattureCount === 1 ? "" : "e";
    return `Impossibile eliminare: ci sono ${row.fattureCount} fattura${plural} collegata${plural}. Le fatture non possono essere cancellate.`;
  }
  if (row.pazientiNonArchiviati > 0) {
    const plural = row.pazientiNonArchiviati === 1 ? "" : "i";
    return `Impossibile eliminare: ${row.pazientiNonArchiviati} paziente${plural} collegato${plural} non ${row.pazientiNonArchiviati === 1 ? "è" : "sono"} ancora archiviato${plural}. Archivialo prima di procedere.`;
  }
  return null;
}

function restoreConflictLabel(row: ArchivedPayerRow): string | null {
  if (!row.restoreConflict) return null;
  const fieldLabel = row.restoreConflict.field === "cf" ? "CF" : "P.IVA";
  return `Ripristino bloccato: esiste già un pagante attivo con lo stesso ${fieldLabel}.`;
}

export function PayersManager({ payers, archivedPayers }: PayersManagerProps) {
  const [view, setView] = useState<"active" | "archived">("active");
  const [open, setOpen] = useState(false);
  const [editingPayer, setEditingPayer] = useState<ActivePayer | null>(null);
  const [viewingPayer, setViewingPayer] = useState<ActivePayer | null>(null);

  const handleOpenNew = () => {
    setEditingPayer(null);
    setOpen(true);
  };

  const handleOpenEdit = (payer: ActivePayer) => {
    setEditingPayer(payer);
    setOpen(true);
  };

  const handleOpenView = (payer: ActivePayer) => {
    setViewingPayer(payer);
  };

  const handleSuccess = () => {
    setOpen(false);
    setEditingPayer(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paganti</h1>
          <p className="text-muted-foreground">Gestione anagrafica paganti</p>
        </div>
        <Button onClick={handleOpenNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nuovo pagante
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={view === "active" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("active")}
        >
          Attivi ({payers.length})
        </Button>
        <Button
          variant={view === "archived" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("archived")}
        >
          Archiviati ({archivedPayers.length})
        </Button>
      </div>

      {view === "active" ? (
        payers.length === 0 ? (
          <p className="text-muted-foreground">Nessun pagante registrato.</p>
        ) : (
          <>
            <div className="hidden max-h-[60vh] overflow-y-auto rounded-lg border lg:block">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Cognome</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Città</TableHead>
                    <TableHead>CAP</TableHead>
                    <TableHead>CF</TableHead>
                    <TableHead>P.IVA</TableHead>
                    <TableHead className="w-24 text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payers.map((payer) => (
                    <TableRow key={payer.id}>
                      <TableCell className="font-medium">{payer.cognome}</TableCell>
                      <TableCell>{payer.nome}</TableCell>
                      <TableCell>{payer.citta}</TableCell>
                      <TableCell>{payer.cap}</TableCell>
                      <TableCell>{payer.cf ?? "-"}</TableCell>
                      <TableCell>{payer.piva ?? "-"}</TableCell>
                      <TableCell className="flex justify-end gap-1">
                        <Tooltip content="Visualizza dettagli pagante">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenView(payer)}
                            aria-label="Visualizza dettagli pagante"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Modifica pagante">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(payer)}
                            aria-label="Modifica pagante"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <ArchivePayerButton id={payer.id} pazienti={payer.pazienti} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="max-h-[60vh] space-y-3 overflow-y-auto lg:hidden">
              {payers.map((payer) => (
                <li key={payer.id} className="rounded-lg border p-4 space-y-3">
                  <div>
                    <p className="font-medium">
                      {payer.cognome} {payer.nome}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {payer.citta} {payer.cap}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <p>CF: {payer.cf ?? "-"}</p>
                    <p>P.IVA: {payer.piva ?? "-"}</p>
                  </div>
                  <div className="flex items-center gap-1 border-t pt-3">
                    <Tooltip content="Visualizza dettagli pagante">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenView(payer)}
                        aria-label="Visualizza dettagli pagante"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Modifica pagante">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(payer)}
                        aria-label="Modifica pagante"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <ArchivePayerButton id={payer.id} pazienti={payer.pazienti} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )
      ) : archivedPayers.length === 0 ? (
        <p className="text-muted-foreground">Nessun pagante archiviato.</p>
      ) : (
        <>
          <div className="hidden max-h-[60vh] overflow-y-auto rounded-lg border lg:block">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Cognome</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CF</TableHead>
                  <TableHead>P.IVA</TableHead>
                  <TableHead>Fatture collegate</TableHead>
                  <TableHead className="w-24 text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedPayers.map((payer) => (
                  <TableRow key={payer.id}>
                    <TableCell className="font-medium">{payer.cognome}</TableCell>
                    <TableCell>{payer.nome}</TableCell>
                    <TableCell>{payer.cf ?? "-"}</TableCell>
                    <TableCell>{payer.piva ?? "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {invoiceImpactLabel(payer) ?? "Nessuna"}
                      {restoreConflictLabel(payer) && (
                        <p className="text-destructive">{restoreConflictLabel(payer)}</p>
                      )}
                      {hardDeleteBlockReason(payer) && (
                        <p className="text-destructive">{hardDeleteBlockReason(payer)}</p>
                      )}
                    </TableCell>
                    <TableCell className="flex justify-end gap-1">
                      <RestorePayerButton
                        id={payer.id}
                        pazientiArchiviati={payer.pazientiArchiviati}
                      />
                      <HardDeletePayerButton
                        id={payer.id}
                        disabledReason={hardDeleteBlockReason(payer)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="max-h-[60vh] space-y-3 overflow-y-auto lg:hidden">
            {archivedPayers.map((payer) => (
              <li key={payer.id} className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="font-medium">
                    {payer.cognome} {payer.nome}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {invoiceImpactLabel(payer) ?? "Nessuna fattura collegata"}
                  </p>
                  {restoreConflictLabel(payer) && (
                    <p className="text-sm text-destructive">
                      {restoreConflictLabel(payer)}
                    </p>
                  )}
                  {hardDeleteBlockReason(payer) && (
                    <p className="text-sm text-destructive">
                      {hardDeleteBlockReason(payer)}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <p>CF: {payer.cf ?? "-"}</p>
                  <p>P.IVA: {payer.piva ?? "-"}</p>
                </div>
                <div className="flex items-center gap-1 border-t pt-3">
                  <RestorePayerButton
                    id={payer.id}
                    pazientiArchiviati={payer.pazientiArchiviati}
                  />
                  <HardDeletePayerButton
                    id={payer.id}
                    disabledReason={hardDeleteBlockReason(payer)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPayer ? "Modifica Pagante" : "Nuovo Pagante"}
            </DialogTitle>
          </DialogHeader>
          <PayerForm payer={editingPayer ?? undefined} onSuccess={handleSuccess} />
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
              Visualizza le informazioni complete del pagante.
            </DialogDescription>
          </DialogHeader>
          {viewingPayer && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Codice Fiscale</p>
                  <p>{viewingPayer.cf ?? "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Partita IVA</p>
                  <p>{viewingPayer.piva ?? "-"}</p>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <p className="font-medium">Pazienti associati</p>
                {viewingPayer.pazienti.length > 0 ? (
                  <ul className="divide-y">
                    {viewingPayer.pazienti.map((patient) => (
                      <li key={patient.id} className="py-2">
                        {patient.cognome} {patient.nome}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Nessun paziente associato.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
