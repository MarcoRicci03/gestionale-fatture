// Regressione SEC-17: getTokenMaxAgeSeconds usa decodeJwt (non verificato,
// legge il payload senza controllare la firma). Prima era esportata e
// accettava un token qualsiasi come parametro: sicura solo perché l'unico
// chiamante esistente le passava sempre un token appena firmato da questo
// server, ma nulla nei tipi impediva a un futuro chiamante di passarle un
// token arbitrario letto da un client. Ora non è più esportata: l'unico modo
// di ottenere token+durata insieme è signSessionWithMaxAge, che li produce
// accoppiati e non accetta mai un token esterno.
//
// JWT_SECRET va impostato PRIMA di importare lib/auth/jwt.ts: import
// dinamico dopo aver valorizzato process.env.JWT_SECRET, come negli altri
// script che toccano questo modulo.
//
// L'unico import è dinamico (vedi sopra): senza un import/export statico,
// TypeScript tratterebbe questo file come uno script globale anziché un
// modulo, facendo collidere `failures` e le altre dichiarazioni con quelle
// di altri script privi di import statici (stesso problema visto in
// verify-jwt-secret-strength.ts/verify-session-token-version.ts).
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

async function testGetTokenMaxAgeSecondsIsNotExported(): Promise<void> {
  const jwtModule = (await import("../lib/auth/jwt")) as Record<string, unknown>;
  assertEqual(
    typeof jwtModule.getTokenMaxAgeSeconds,
    "undefined",
    "getTokenMaxAgeSeconds non deve essere esportata dal modulo (deve restare privata)"
  );
  assertEqual(
    typeof jwtModule.signSessionWithMaxAge,
    "function",
    "signSessionWithMaxAge deve essere l'unico modo esposto per ottenere token+durata"
  );
}

async function testSignSessionWithMaxAgeComputesConsistentDuration(): Promise<void> {
  const { signSessionWithMaxAge } = await import("../lib/auth/jwt");
  const { decodeJwt } = await import("jose");

  const { token, maxAgeSeconds } = await signSessionWithMaxAge(42, 0);

  const { exp, iat } = decodeJwt(token);
  if (typeof exp !== "number" || typeof iat !== "number") {
    failures.push("il token firmato deve avere claim exp/iat numerici");
    return;
  }

  assertEqual(
    maxAgeSeconds,
    exp - iat,
    "maxAgeSeconds deve corrispondere esattamente a exp - iat del token appena firmato"
  );

  // Default JWT_EXPIRES_IN non impostato in questo script => fallback "7d" in signSession.
  const sevenDaysInSeconds = 7 * 24 * 60 * 60;
  assertEqual(
    maxAgeSeconds,
    sevenDaysInSeconds,
    'con JWT_EXPIRES_IN non impostato, la durata deve corrispondere al fallback "7d"'
  );
}

async function main(): Promise<void> {
  await testGetTokenMaxAgeSecondsIsNotExported();
  await testSignSessionWithMaxAgeComputesConsistentDuration();

  if (failures.length > 0) {
    console.error("verify-jwt-max-age-encapsulation: FALLITO");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    "getTokenMaxAgeSeconds è privata e signSessionWithMaxAge produce token e durata correttamente accoppiati."
  );
}

main();
