// Regola pura di consequenzialità cronologica per le fatture, condivisa tra
// createInvoice/updateInvoice (lib/actions/invoices.ts) e questo test.
// LOG-04 in SECURITY_AUDIT.md: bloccare n_fattura/anno dopo l'emissione non
// basta se giorno/mese della data restano liberi — si potrebbe comunque
// creare un'inversione (es. fattura #6 con data precedente alla #5). Per
// lo stesso (id_Utente, anno), la data deve restare compresa tra il vicino
// con n_fattura immediatamente minore e quello immediatamente maggiore,
// estremi inclusi.

export type ChronologyNeighbor = {
  n_fattura: number;
  data: Date;
};

export type ChronologyConflict = {
  side: "precedente" | "successivo";
  neighbor: ChronologyNeighbor;
};

export function findChronologyConflict(
  data: Date,
  previous: ChronologyNeighbor | null,
  next: ChronologyNeighbor | null
): ChronologyConflict | null {
  if (previous && data.getTime() < previous.data.getTime()) {
    return { side: "precedente", neighbor: previous };
  }
  if (next && data.getTime() > next.data.getTime()) {
    return { side: "successivo", neighbor: next };
  }
  return null;
}

export function formatChronologyConflictMessage(
  conflict: ChronologyConflict
): string {
  const dataLabel = conflict.neighbor.data.toLocaleDateString("it-IT");
  if (conflict.side === "precedente") {
    return `La data non può essere precedente al ${dataLabel} (fattura #${conflict.neighbor.n_fattura}), per rispettare l'ordine cronologico della numerazione.`;
  }
  return `La data non può essere successiva al ${dataLabel} (fattura #${conflict.neighbor.n_fattura}), per rispettare l'ordine cronologico della numerazione.`;
}
