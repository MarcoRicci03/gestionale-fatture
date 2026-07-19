import { SAFE_USER_SELECT } from "../lib/data/user-select";

// Regressione: SAFE_USER_SELECT alimenta componenti client
// (UsersManager/UserForm) tramite lib/data/users.ts — se qualcuno vi
// aggiunge `passwordHash: true` per errore, l'hash bcrypt di ogni utente
// finirebbe nel payload RSC inviato al browser dell'admin.
const FORBIDDEN_FIELDS = ["passwordHash"] as const;

const leaked = FORBIDDEN_FIELDS.filter(
  (field) => (SAFE_USER_SELECT as Record<string, boolean>)[field] === true
);

if (leaked.length > 0) {
  console.error(
    `SAFE_USER_SELECT espone campi sensibili al client: ${leaked.join(", ")}`
  );
  process.exit(1);
}

console.log("SAFE_USER_SELECT non espone campi sensibili.");
