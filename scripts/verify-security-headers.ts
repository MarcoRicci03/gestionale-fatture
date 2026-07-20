// Regressione SEC-06: next.config.ts non impostava alcun header di
// sicurezza HTTP (CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
// Referrer-Policy, Permissions-Policy). Questo script chiama direttamente
// `headers()` dalla config esportata (senza bisogno di un server Next.js
// realmente in ascolto — impossibile qui, dato che Next.js rifiuta una
// seconda istanza `next dev` sullo stesso progetto) e verifica che gli
// header attesi siano presenti con i valori corretti, sia in sviluppo sia in
// produzione.
//
// Nessun import statico in questo file (solo import dinamici, vedi sotto):
// senza un import/export statico, TypeScript lo tratterebbe come uno script
// globale anziché un modulo, facendo collidere `failures` e le altre
// dichiarazioni con quelle di altri script privi di import statici.
export {};

// @types/node dichiara NODE_ENV readonly per scoraggiarne la mutazione a
// runtime nel codice applicativo: qui serve invece deliberatamente, per
// testare che next.config.ts emetta header diversi in dev/produzione senza
// dover far ripartire il processo con un NODE_ENV diverso ogni volta.
type MutableProcessEnv = { NODE_ENV: string };
const mutableEnv = process.env as unknown as MutableProcessEnv;

const failures: string[] = [];

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    failures.push(
      `${message} — atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`
    );
  }
}

type HeaderEntry = { key: string; value: string };
type HeaderRule = { source: string; headers: HeaderEntry[] };

function findHeaderValue(rules: HeaderRule[], key: string): string | undefined {
  for (const rule of rules) {
    const match = rule.headers.find((h) => h.key === key);
    if (match) return match.value;
  }
  return undefined;
}

async function loadHeadersFor(nodeEnv: string): Promise<HeaderRule[]> {
  const previousNodeEnv = mutableEnv.NODE_ENV;
  mutableEnv.NODE_ENV = nodeEnv;
  try {
    // Import dinamico DOPO aver impostato NODE_ENV: il modulo legge
    // process.env.NODE_ENV una sola volta, al caricamento — serve un import
    // fresco per ogni valore testato. Il query param cache-busta la cache
    // dei moduli di Node (altrimenti il secondo import riuso il primo).
    const mod = await import(`../next.config.ts?nodeEnv=${nodeEnv}`);
    const config = mod.default;
    const rules = (await config.headers()) as HeaderRule[];
    return rules;
  } finally {
    mutableEnv.NODE_ENV = previousNodeEnv;
  }
}

async function testAlwaysPresentHeaders(): Promise<void> {
  for (const nodeEnv of ["development", "production"]) {
    const rules = await loadHeadersFor(nodeEnv);

    assertEqual(
      findHeaderValue(rules, "X-Frame-Options"),
      "DENY",
      `[${nodeEnv}] X-Frame-Options deve essere impostato a DENY`
    );
    assertEqual(
      findHeaderValue(rules, "X-Content-Type-Options"),
      "nosniff",
      `[${nodeEnv}] X-Content-Type-Options deve essere impostato a nosniff`
    );
    if (!findHeaderValue(rules, "Referrer-Policy")) {
      failures.push(`[${nodeEnv}] Referrer-Policy deve essere impostato`);
    }
    if (!findHeaderValue(rules, "Permissions-Policy")) {
      failures.push(`[${nodeEnv}] Permissions-Policy deve essere impostato`);
    }
  }
}

async function testProductionOnlyHeaders(): Promise<void> {
  const devRules = await loadHeadersFor("development");
  assertEqual(
    findHeaderValue(devRules, "Content-Security-Policy"),
    undefined,
    "in sviluppo la CSP non deve essere impostata (romperebbe Turbopack HMR)"
  );
  assertEqual(
    findHeaderValue(devRules, "Strict-Transport-Security"),
    undefined,
    "in sviluppo HSTS non deve essere impostato"
  );

  const prodRules = await loadHeadersFor("production");
  const csp = findHeaderValue(prodRules, "Content-Security-Policy");
  if (!csp) {
    failures.push("in produzione la Content-Security-Policy deve essere impostata");
  } else {
    for (const expectedDirective of [
      "default-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ]) {
      if (!csp.includes(expectedDirective)) {
        failures.push(
          `la CSP di produzione deve includere la direttiva "${expectedDirective}"`
        );
      }
    }
  }

  const hsts = findHeaderValue(prodRules, "Strict-Transport-Security");
  if (!hsts || !hsts.includes("max-age=")) {
    failures.push("in produzione Strict-Transport-Security deve essere impostato con max-age");
  }
}

async function main(): Promise<void> {
  await testAlwaysPresentHeaders();
  await testProductionOnlyHeaders();

  if (failures.length > 0) {
    console.error("verify-security-headers: FALLITO");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    "Gli header di sicurezza HTTP attesi sono impostati correttamente (sempre, e CSP/HSTS solo in produzione)."
  );
}

main();
