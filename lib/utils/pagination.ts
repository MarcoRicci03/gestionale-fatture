import { z } from "zod";

// Ultima pagina effettivamente valida per un dato totale di righe: mai sotto
// 1 (anche con 0 risultati, "pagina 1 vuota" è lo stato da mostrare, non
// "pagina 0"). Usata per riportare a un valore sensato una `page` richiesta
// oltre il range disponibile (utente su un'ultima pagina poi svuotata da una
// cancellazione, o URL manomesso), invece di lasciarla come dead-end.
export function lastValidPage(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

// Il limite superiore è difesa in profondità, non la fonte di verità sul
// range valido: quella vive nel data layer (es. getInvoices() in
// lib/data/invoices.ts), che clampa `page` all'ultima pagina realmente
// disponibile una volta noto `totalCount`. Senza QUESTO limite, però, un
// valore come "100000000000000000000" supererebbe comunque
// .int().positive() (è un intero rappresentabile in floating point) e
// produrrebbe uno `skip` enorme prima ancora che il data layer possa
// clampare nulla, rischiando un errore non gestito lato Postgres sull'OFFSET.
export const pageSchema = z.coerce.number().int().positive().max(1_000_000);
