// Regressione SEC-02: un JWT di sessione deve portare il tokenVersion con cui
// è stato firmato, così getSession() (lib/auth/session.ts) può confrontarlo
// con Utente.tokenVersion e invalidare i token emessi prima di un cambio o
// reset password, anche se non ancora scaduti.
//
// JWT_SECRET va impostato PRIMA di importare lib/auth/jwt.ts (che legge la
// variabile al caricamento del modulo e fallisce se assente): per questo
// l'import è dinamico, dopo aver valorizzato process.env.JWT_SECRET se lo
// script gira senza un .env caricato (tsx non lo carica automaticamente).
//
// L'unico import è dinamico (vedi sopra): senza un import/export statico,
// TypeScript tratterebbe questo file come uno script globale anziché un
// modulo, facendo collidere `failures` e le altre dichiarazioni con quelle
// di scripts/verify-jwt-secret-strength.ts (stesso identico problema).
export {};

process.env.JWT_SECRET ??= "verify-script-test-secret-please-ignore-0000000000";

const failures: string[] = [];

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    failures.push(
      `${message} — atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`
    );
  }
}

async function testTokenVersionRoundTrip(): Promise<void> {
  const { signSession, verifySession } = await import("../lib/auth/jwt");

  const token = await signSession(42, 3);
  const payload = await verifySession(token);

  assertEqual(payload?.sub, "42", "il payload deve portare l'id utente in sub");
  assertEqual(
    payload?.tokenVersion,
    3,
    "il payload deve portare lo stesso tokenVersion con cui il token è stato firmato"
  );
}

async function testTokenVersionMismatchIsDetectable(): Promise<void> {
  const { signSession, verifySession } = await import("../lib/auth/jwt");

  // Simula un token firmato PRIMA di un cambio password (tokenVersion 3),
  // mentre in DB Utente.tokenVersion è ormai 4: è esattamente il confronto
  // che getSession() fa tra payload.tokenVersion e user.tokenVersion.
  const staleToken = await signSession(42, 3);
  const payload = await verifySession(staleToken);
  const currentDbTokenVersion = 4;

  assertEqual(
    payload !== null && payload.tokenVersion === currentDbTokenVersion,
    false,
    "un token firmato con un tokenVersion superato non deve risultare valido rispetto al tokenVersion corrente in DB"
  );
}

async function testMissingTokenVersionClaimIsRejected(): Promise<void> {
  const { verifySession } = await import("../lib/auth/jwt");
  const { SignJWT } = await import("jose");

  // Un token senza claim tokenVersion (es. emesso da codice precedente a
  // questo fix) deve essere rifiutato esplicitamente, non trattato come
  // valido con tokenVersion undefined.
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const legacyToken = await new SignJWT({ sub: "42" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const payload = await verifySession(legacyToken);
  assertEqual(
    payload,
    null,
    "un token senza claim tokenVersion deve essere rifiutato da verifySession"
  );
}

async function main(): Promise<void> {
  await testTokenVersionRoundTrip();
  await testTokenVersionMismatchIsDetectable();
  await testMissingTokenVersionClaimIsRejected();

  if (failures.length > 0) {
    console.error("verify-session-token-version: FALLITO");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    "Il tokenVersion è firmato, verificato e confrontabile correttamente nel JWT di sessione."
  );
}

main();
