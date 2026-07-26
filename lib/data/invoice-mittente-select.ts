import type { Prisma } from "@prisma/client";

// Whitelist esplicita, stesso pattern di lib/data/user-select.ts. A
// differenza di SAFE_USER_SELECT (pensato per essere "sicuro da esporre a
// qualunque client"), questo select è più stretto: solo i campi che
// lib/pdf/placeholders.ts legge da invoice.utente per i placeholder
// {{mittente.*}}. getInvoiceById (lib/data/invoices.ts) alimenta
// app/api/invoices/[id]/pdf/route.ts, oggi l'unico consumatore — ma un
// `include: { utente: true }` porterebbe in memoria l'intera riga Utente,
// passwordHash incluso, bastando un futuro componente client che riceva
// l'invoice per farlo finire nel payload RSC.
export const INVOICE_MITTENTE_SELECT = {
  nome: true,
  cognome: true,
  titolo: true,
  specializzazione: true,
  pIva: true,
  cf: true,
  via: true,
  cap: true,
  citta: true,
  provincia: true,
} satisfies Prisma.UtenteSelect;

export type InvoiceMittente = Prisma.UtenteGetPayload<{
  select: typeof INVOICE_MITTENTE_SELECT;
}>;
