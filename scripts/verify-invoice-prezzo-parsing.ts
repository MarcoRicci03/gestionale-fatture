import { invoiceSchema } from "../lib/validations/invoice";

// Regressione LOG-05: mesi[].prezzo trasformava qualunque input non
// numerico (es. "50,00", virgola decimale italiana, o testo arbitrario) in
// NaN e poi lo degradava silenziosamente a 0 — una fattura poteva essere
// salvata con un importo sbagliato senza alcun errore di validazione. Questo
// script verifica che invoiceSchema ora rifiuti l'input non parsabile
// invece di inghiottirlo, normalizzi la virgola italiana in punto, e
// vincoli il prezzo a un numero non negativo con al massimo 2 decimali.

const failures: string[] = [];

function assertRejects(result: { success: boolean }, message: string): void {
  if (result.success) {
    failures.push(`${message} — atteso il rifiuto, l'input è stato accettato`);
  }
}

function assertPrezzo(
  result: { success: boolean; data?: unknown; error?: unknown },
  atteso: number,
  message: string
): void {
  if (!result.success) {
    failures.push(
      `${message} — atteso prezzo=${atteso}, l'input è stato rifiutato: ${JSON.stringify(
        "error" in result ? result.error : undefined
      )}`
    );
    return;
  }
  const data = result.data as { mesi: { prezzo: number }[] };
  const prezzo = data.mesi[0].prezzo;
  if (prezzo !== atteso) {
    failures.push(`${message} — atteso prezzo=${atteso}, ottenuto ${prezzo}`);
  }
}

const baseInvoice = {
  id_Pagante: 1,
  id_Paziente: 1,
  data: "2026-01-01",
  mod_pag: "CONTANTI" as const,
  n_fattura: 1,
  citta: "Roma",
  cap: "00100",
};

function withPrezzo(prezzo: unknown) {
  return { ...baseInvoice, mesi: [{ mese: "GENNAIO", prezzo }] };
}

function testTestoNonNumericoRifiutato(): void {
  assertRejects(
    invoiceSchema.safeParse(withPrezzo("abc")),
    "Prezzo testo arbitrario ('abc') deve essere rifiutato, non degradato a 0"
  );
}

function testVirgolaItalianaNormalizzataENonRifiutata(): void {
  assertPrezzo(
    invoiceSchema.safeParse(withPrezzo("50,00")),
    50,
    "Prezzo con virgola decimale italiana ('50,00') deve essere accettato e normalizzato a 50"
  );
  assertPrezzo(
    invoiceSchema.safeParse(withPrezzo("12,5")),
    12.5,
    "Prezzo '12,5' deve essere accettato e normalizzato a 12.5"
  );
}

function testPuntoDecimaleAccettato(): void {
  assertPrezzo(
    invoiceSchema.safeParse(withPrezzo("50.40")),
    50.4,
    "Prezzo '50.40' (punto) deve essere accettato"
  );
}

function testStringaVuotaRestaZero(): void {
  // Un solo mese a "" farebbe fallire anche il refine "totale > 0"
  // preesistente (indipendente da questo fix): aggiunto un secondo mese con
  // importo positivo per isolare il comportamento di "" sul primo.
  const result = invoiceSchema.safeParse({
    ...baseInvoice,
    mesi: [
      { mese: "GENNAIO", prezzo: "" },
      { mese: "FEBBRAIO", prezzo: 10 },
    ],
  });
  if (!result.success) {
    failures.push(
      `Prezzo stringa vuota deve restare 0 (mese senza importo) — rifiutato: ${JSON.stringify(result.error)}`
    );
    return;
  }
  const data = result.data as { mesi: { prezzo: number }[] };
  if (data.mesi[0].prezzo !== 0) {
    failures.push(
      `Prezzo stringa vuota deve restare 0 (mese senza importo) — ottenuto ${data.mesi[0].prezzo}`
    );
  }
}

function testPiuDiDueDecimaliRifiutato(): void {
  assertRejects(
    invoiceSchema.safeParse(withPrezzo("50,123")),
    "Prezzo con più di 2 decimali ('50,123') deve essere rifiutato"
  );
}

function testNegativoRifiutato(): void {
  assertRejects(
    invoiceSchema.safeParse(withPrezzo("-10")),
    "Prezzo negativo ('-10') deve essere rifiutato"
  );
}

function testNumeroDirettoValido(): void {
  assertPrezzo(
    invoiceSchema.safeParse(withPrezzo(50)),
    50,
    "Prezzo passato come numero JS valido (50) deve essere accettato"
  );
}

function testNumeroDirettoConTroppiDecimaliRifiutato(): void {
  assertRejects(
    invoiceSchema.safeParse(withPrezzo(50.123)),
    "Prezzo passato come numero JS con più di 2 decimali (50.123) deve essere rifiutato"
  );
}

testTestoNonNumericoRifiutato();
testVirgolaItalianaNormalizzataENonRifiutata();
testPuntoDecimaleAccettato();
testStringaVuotaRestaZero();
testPiuDiDueDecimaliRifiutato();
testNegativoRifiutato();
testNumeroDirettoValido();
testNumeroDirettoConTroppiDecimaliRifiutato();

if (failures.length > 0) {
  console.error("verify-invoice-prezzo-parsing: FALLITO");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  "mesi[].prezzo normalizza la virgola decimale italiana e rifiuta input non numerici/oltre 2 decimali invece di degradare a 0."
);
