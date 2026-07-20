// Regressione SEC-03: con HS256 chiunque conosca JWT_SECRET può forgiare un
// token di sessione valido per QUALSIASI utente (basta impostare `sub` a
// piacere). lib/auth/jwt.ts deve rifiutare un segreto corto o un valore
// segnaposto noto (es. "change-me"), non limitarsi a verificarne la
// presenza.
//
// JWT_SECRET va impostato PRIMA di importare lib/auth/jwt.ts (che lo legge e
// valida al caricamento del modulo): import dinamico dopo aver valorizzato
// process.env.JWT_SECRET con un segreto valido, così il modulo si carica una
// volta sola e assertStrongJwtSecret può poi essere richiamata direttamente
// con altri valori, senza dover far ripartire il processo.
//
// L'unico import è dinamico (vedi sopra): senza un import/export statico,
// TypeScript tratterebbe questo file come uno script globale anziché un
// modulo, facendo collidere `failures` e le altre dichiarazioni con quelle
// di scripts/verify-session-token-version.ts (stesso identico problema).
export {};

process.env.JWT_SECRET ??= "verify-script-test-secret-please-ignore-0000000000";

const failures: string[] = [];

function assertThrows(fn: () => void, message: string): void {
  try {
    fn();
    failures.push(`${message} — non ha lanciato un errore`);
  } catch {
    // atteso
  }
}

function assertDoesNotThrow(fn: () => void, message: string): void {
  try {
    fn();
  } catch (err) {
    failures.push(
      `${message} — ha lanciato inaspettatamente: ${String((err as Error)?.message ?? err)}`
    );
  }
}

async function main(): Promise<void> {
  const { assertStrongJwtSecret } = await import("../lib/auth/jwt");

  assertThrows(
    () => assertStrongJwtSecret("change-me"),
    'un valore segnaposto noto ("change-me") deve essere rifiutato'
  );
  assertThrows(
    () => assertStrongJwtSecret("CHANGE-ME"),
    "il controllo sui segnaposto deve ignorare maiuscole/minuscole"
  );
  assertThrows(
    () => assertStrongJwtSecret("short-secret-1234"), // < 32 byte
    "un segreto più corto di 32 byte deve essere rifiutato"
  );
  assertThrows(
    () => assertStrongJwtSecret(""),
    "una stringa vuota deve essere rifiutata"
  );
  assertDoesNotThrow(
    () => assertStrongJwtSecret("a-very-long-randomly-generated-secret-1234567890"),
    "un segreto lungo e non segnaposto deve essere accettato"
  );

  if (failures.length > 0) {
    console.error("verify-jwt-secret-strength: FALLITO");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    "JWT_SECRET debole (corto o segnaposto) viene rifiutato; un segreto robusto viene accettato."
  );
}

main();
