import type { Prisma } from "@prisma/client";

// Esclude esplicitamente `passwordHash`: questo select alimenta componenti
// client (UsersManager/UserForm via lib/data/users.ts), quindi il valore
// restituito finisce serializzato nel payload RSC inviato al browser.
// Whitelist intenzionale: qualsiasi nuovo campo su Utente NON compare qui
// finché non viene aggiunto esplicitamente.
export const SAFE_USER_SELECT = {
  id: true,
  username: true,
  nome: true,
  cognome: true,
  pIva: true,
  cf: true,
  via: true,
  citta: true,
  cap: true,
  provincia: true,
  titolo: true,
  specializzazione: true,
  isAdmin: true,
  abilitato: true,
  mustChangePassword: true,
  createdAt: true,
} satisfies Prisma.UtenteSelect;

export type SafeUtente = Prisma.UtenteGetPayload<{
  select: typeof SAFE_USER_SELECT;
}>;
