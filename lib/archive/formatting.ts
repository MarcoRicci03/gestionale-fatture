/**
 * Funzioni di formattazione condivise per la gestione e l'archiviazione di Pazienti e Paganti (DRY-01).
 */

export function formatCurrency(amount: number): string {
  return amount.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
}

export type InvoiceImpactData = {
  count: number;
  totale: number;
  annoMin: number | null;
  annoMax: number | null;
};

export function formatArchiveInvoiceImpact(impact: InvoiceImpactData): string | null {
  if (impact.count === 0) return null;
  const years =
    impact.annoMin === impact.annoMax
      ? `${impact.annoMin}`
      : `${impact.annoMin}-${impact.annoMax}`;
  const noun = impact.count === 1 ? "fattura collegata" : "fatture collegate";
  return `${impact.count} ${noun} (${years}, ${formatCurrency(impact.totale)})`;
}

export function getHardDeleteInvoiceBlockReason(count: number): string | null {
  if (count <= 0) return null;
  const collegate = count === 1 ? "c'è 1 fattura collegata" : `ci sono ${count} fatture collegate`;
  return `Impossibile eliminare: ${collegate}. Le fatture non possono essere cancellate.`;
}

export function getHardDeletePatientsBlockReason(count: number): string | null {
  if (count <= 0) return null;
  if (count === 1) {
    return "Impossibile eliminare: 1 paziente collegato non è ancora archiviato. Archivialo prima di procedere.";
  }
  return `Impossibile eliminare: ${count} pazienti collegati non sono ancora archiviati. Archiviali prima di procedere.`;
}
