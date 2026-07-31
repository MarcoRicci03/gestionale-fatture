import type { Pagante, Paziente } from "@prisma/client";
import type {
  PayerOption,
  PatientOption,
} from "@/lib/data/invoice-contact-options-select";

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
//
// Generiche su T, inferito SOLO dall'elenco (payers/patients) — mai da
// current/currentPayer, tipizzati a parte: il "current" passato dal form è
// la relazione completa dell'invoice (Pagante/Paziente pieni), mentre
// l'elenco è il tipo ristretto delle tendine (PayerOption/PatientOption,
// PERF-02). Legarli allo stesso T avrebbe reso l'inferenza ambigua tra i due
// argomenti; qui restano indipendenti e il risultato del merge viene
// esplicitamente forzato a T, come già faceva questa funzione prima di
// PERF-02.
export function withCurrentPayer<T extends { id: number }>(
  payers: T[],
  current: (Pagante | PayerOption) | null | undefined
): T[] {
  if (!current || payers.some((p) => p.id === current.id)) return payers;
  return [...payers, current as unknown as T];
}

// currentPayer viene passato esplicitamente invece di dedurlo da
// current.id_Pagante perché serve l'oggetto pagante completo per il campo
// annidato `pagante` richiesto dal tipo di riga usato dal form
// (PatientOption, che lo porta opzionale — vedi
// lib/data/invoice-contact-options-select.ts). Per una fattura esistente,
// paziente.id_Pagante === invoice.id_Pagante è già garantito da
// validateInvoiceRelations al momento del salvataggio: non va ricontrollato
// qui.
export function withCurrentPatient<
  T extends { id: number; pagante?: PayerOption | Pagante | null }
>(
  patients: T[],
  current: (Paziente | PatientOption) | null | undefined,
  currentPayer: (Pagante | PayerOption) | null | undefined
): T[] {
  if (!current || patients.some((p) => p.id === current.id)) return patients;
  return [
    ...patients,
    { ...current, pagante: currentPayer ?? null } as unknown as T,
  ];
}
