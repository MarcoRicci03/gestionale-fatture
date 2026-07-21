import { payerSchema } from "../lib/validations/payer";

// Regressione LOG-09: cf/piva su payerSchema (lib/validations/payer.ts)
// accettavano qualunque stringa entro un limite di lunghezza ("abc" era un
// codice fiscale valido), a differenza di profileUpdateSchema che già usava
// le regex corrette. Questo script verifica che payerSchema ora usi le
// stesse regex (CF_REGEX/PIVA_REGEX, condivise da lib/constants/fiscal.ts),
// rifiuti formati non validi e normalizzi il CF in maiuscolo.

const failures: string[] = [];

function assertRejects(result: { success: boolean }, message: string): void {
  if (result.success) {
    failures.push(`${message} — atteso il rifiuto, l'input è stato accettato`);
  }
}

const basePayer = {
  nome: "Mario",
  cognome: "Rossi",
  via: "Via Roma 1",
  citta: "Roma",
  cap: "00100",
};

function testCfNonNumericoTestoArbitrarioRifiutato(): void {
  assertRejects(
    payerSchema.safeParse({ ...basePayer, cf: "abc" }),
    "CF con testo arbitrario troppo corto ('abc') deve essere rifiutato"
  );
  assertRejects(
    payerSchema.safeParse({ ...basePayer, cf: "!".repeat(16) }),
    "CF di 16 caratteri ma con simboli non alfanumerici deve essere rifiutato"
  );
}

function testCfValidoAccettatoENormalizzatoMaiuscolo(): void {
  const result = payerSchema.safeParse({ ...basePayer, cf: "rssmra80a01h501z" });
  if (!result.success) {
    failures.push(
      `CF valido in minuscolo ('rssmra80a01h501z') deve essere accettato — rifiutato: ${JSON.stringify(result.error)}`
    );
  } else if (result.data.cf !== "RSSMRA80A01H501Z") {
    failures.push(
      `CF valido in minuscolo deve essere normalizzato in maiuscolo — ottenuto ${result.data.cf}`
    );
  }
}

function testPivaNonNumericaRifiutata(): void {
  assertRejects(
    payerSchema.safeParse({ ...basePayer, piva: "abcdefghijk" }),
    "P.IVA non numerica ('abcdefghijk', 11 caratteri) deve essere rifiutata"
  );
  assertRejects(
    payerSchema.safeParse({ ...basePayer, piva: "123456789" }),
    "P.IVA di sole 9 cifre deve essere rifiutata"
  );
}

function testPivaValidaAccettata(): void {
  const result = payerSchema.safeParse({ ...basePayer, piva: "12345678901" });
  if (!result.success) {
    failures.push(
      `P.IVA valida (11 cifre) deve essere accettata — rifiutata: ${JSON.stringify(result.error)}`
    );
  }
}

testCfNonNumericoTestoArbitrarioRifiutato();
testCfValidoAccettatoENormalizzatoMaiuscolo();
testPivaNonNumericaRifiutata();
testPivaValidaAccettata();

if (failures.length > 0) {
  console.error("verify-payer-fiscal-format: FALLITO");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  "payerSchema valida il formato di CF/P.IVA con le stesse regex del profilo e normalizza il CF in maiuscolo."
);
