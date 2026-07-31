import type { Prisma } from "@prisma/client";

// Whitelist esplicita per le tendine pagante/paziente del form fattura
// (PERF-02), stesso pattern di lib/data/invoice-mittente-select.ts. Quelle
// tendine mostrano solo "cognome nome" (+ "(archiviato)" per il contatto
// già assegnato alla fattura in modifica, vedi
// lib/invoices/contact-options.ts), il filtro paziente→pagante usa
// id_Pagante, e l'autocompilazione città/CAP alla selezione del pagante usa
// citta/cap. Un `Pagante`/`Paziente` completo (via, cf, piva, id_Utente...)
// più un `include: { pagante: true }` sul paziente finivano serializzati per
// intero nel payload RSC di /invoices a ogni caricamento — spesso duplicati,
// quando più pazienti condividono lo stesso pagante.
export const PAYER_OPTION_SELECT = {
  id: true,
  nome: true,
  cognome: true,
  citta: true,
  cap: true,
  archiviato: true,
} satisfies Prisma.PaganteSelect;

export type PayerOption = Prisma.PaganteGetPayload<{
  select: typeof PAYER_OPTION_SELECT;
}>;

export const PATIENT_OPTION_SELECT = {
  id: true,
  nome: true,
  cognome: true,
  id_Pagante: true,
  archiviato: true,
} satisfies Prisma.PazienteSelect;

// `pagante` è opzionale e assente dalla query di base (niente `include`, per
// il motivo sopra): withCurrentPatient (lib/invoices/contact-options.ts) lo
// popola solo sull'unico paziente della fattura in modifica, quando è stato
// archiviato nel frattempo e va reinserito tra le opzioni.
export type PatientOption = Prisma.PazienteGetPayload<{
  select: typeof PATIENT_OPTION_SELECT;
}> & {
  pagante?: PayerOption | null;
};
