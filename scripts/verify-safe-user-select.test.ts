import { it, expect } from "vitest";
import { SAFE_USER_SELECT } from "../lib/data/user-select";
import { INVOICE_MITTENTE_SELECT } from "../lib/data/invoice-mittente-select";

// Regressione: SAFE_USER_SELECT alimenta componenti client
// (UsersManager/UserForm) tramite lib/data/users.ts — se qualcuno vi
// aggiunge `passwordHash: true` per errore, l'hash bcrypt di ogni utente
// finirebbe nel payload RSC inviato al browser dell'admin. Stesso rischio
// per INVOICE_MITTENTE_SELECT (lib/data/invoices.ts, getInvoiceById): senza
// un select esplicito, `utente: true` porterebbe in memoria l'intera riga
// Utente, passwordHash incluso (SEC-03).
const FORBIDDEN_FIELDS = ["passwordHash"] as const;

it("SAFE_USER_SELECT non espone campi sensibili", () => {
  const leaked = FORBIDDEN_FIELDS.filter(
    (field) => (SAFE_USER_SELECT as Record<string, boolean>)[field] === true
  );
  expect(leaked).toEqual([]);
});

it("INVOICE_MITTENTE_SELECT non espone campi sensibili", () => {
  const leaked = FORBIDDEN_FIELDS.filter(
    (field) =>
      (INVOICE_MITTENTE_SELECT as Record<string, boolean>)[field] === true
  );
  expect(leaked).toEqual([]);
});

it("INVOICE_MITTENTE_SELECT contiene esattamente i campi letti da lib/pdf/placeholders.ts", () => {
  // Più stretto della sola assenza di campi sensibili: questo select esiste
  // per il principio di minimo privilegio (SEC-03), non solo per evitare un
  // leak. Se un domani serve un nuovo placeholder {{mittente.*}}, questo
  // test fallisce finché non si aggiunge esplicitamente il campo qui.
  const expectedFields = [
    "nome",
    "cognome",
    "titolo",
    "specializzazione",
    "pIva",
    "cf",
    "via",
    "cap",
    "citta",
    "provincia",
  ].sort();
  expect(Object.keys(INVOICE_MITTENTE_SELECT).sort()).toEqual(expectedFields);
});
