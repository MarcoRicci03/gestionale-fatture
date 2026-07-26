import type { Pagante, Paziente } from "@prisma/client";

// Le tendine pagante/paziente del form fattura ricevono solo i contatti
// attivi (getPayersAndPatients filtra archiviato: false, lib/data/invoices.ts):
// se il pagante o il paziente collegati alla fattura in modifica sono stati
// archiviati nel frattempo, non compaiono più tra le opzioni e il campo
// appare vuoto, pur restando correttamente collegati in DB. Queste funzioni
// reinseriscono SOLO il contatto già assegnato a QUESTA fattura (se
// archiviato e non già presente) — mai altri contatti archiviati: creare una
// fattura, o riassegnarne una esistente a un contatto diverso, deve
// continuare a richiedere un contatto attivo (vedi anche
// lib/actions/invoices.ts, validateInvoiceRelations).
export function withCurrentPayer(
  payers: Pagante[],
  current: Pagante | null | undefined
): Pagante[] {
  if (!current || payers.some((p) => p.id === current.id)) return payers;
  return [...payers, current];
}

// currentPayer viene passato esplicitamente invece di dedurlo da
// current.id_Pagante perché serve l'oggetto Pagante completo per il campo
// annidato `pagante` richiesto dal tipo di riga usato dal form
// (Paziente & { pagante: Pagante | null }). Per una fattura esistente,
// paziente.id_Pagante === invoice.id_Pagante è già garantito da
// validateInvoiceRelations al momento del salvataggio: non va ricontrollato
// qui.
export function withCurrentPatient<T extends Paziente & { pagante?: Pagante | null }>(
  patients: T[],
  current: Paziente | null | undefined,
  currentPayer: Pagante | null | undefined
): T[] {
  if (!current || patients.some((p) => p.id === current.id)) return patients;
  return [...patients, { ...current, pagante: currentPayer ?? null } as T];
}
