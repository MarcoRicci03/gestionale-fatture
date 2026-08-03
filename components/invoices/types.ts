import type { FatturaMese, Pagamento, Pagante, Paziente } from "@prisma/client";

// prezzo_totale/mesi[].prezzo arrivano già convertiti da Decimal a number
// (vedi serializeInvoice in lib/data/invoices.ts).
//
// Non collide col tipo omonimo `InvoiceWithRelations` di lib/pdf/types.ts
// (pagante/paziente/utente sempre presenti, per la pipeline di generazione
// PDF) né con quello locale, non esportato, di invoice-form.tsx: questo è
// specifico della lista fatture (`InvoicesManager` e i suoi componenti
// figli), dove pagante/paziente possono essere `null` (fattura orfana per
// pagante/paziente archiviato/eliminato).
export type InvoiceListItem = Omit<Pagamento, "prezzo_totale"> & {
  prezzo_totale: number;
  mesi: (Omit<FatturaMese, "prezzo"> & { prezzo: number })[];
  pagante: Pagante | null;
  paziente: Paziente | null;
};
