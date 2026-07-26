const MAX_VISIBLE_CHARS = 3;

// L'errore di digitazione più comune al login è scrivere la password nel
// campo username. Se questo capita su un tentativo con username
// inesistente, il valore finisce in audit_logs.meta (lib/actions/auth.ts) e
// resta visibile in chiaro nella UI /audit-log a ogni admin — esattamente
// ciò che il commento in lib/audit/log.ts vieta esplicitamente per le
// password. Tronca a pochi caratteri: sufficiente a riconoscere pattern
// ripetuti (stesso username tentato più volte, varianti simili) senza
// esporre per intero una password che sia finita per errore in quel campo.
// Sotto la soglia non tronca affatto: una password valida ha sempre almeno
// 12 caratteri (lib/validations/user.ts), quindi una stringa già più corta
// della soglia non può comunque essere una password.
export function redactUsernameForAudit(username: string): string {
  if (username.length <= MAX_VISIBLE_CHARS) return username;
  return `${username.slice(0, MAX_VISIBLE_CHARS)}…`;
}
