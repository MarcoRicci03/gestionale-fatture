import { roundCurrency } from "../lib/utils/currency";
import { invoiceSchema } from "../lib/validations/invoice";
import { SOGLIA_BOLLO } from "../lib/constants/bollo";

// Regressione LOG-06: gli importi diventano `number` non appena escono dal
// data layer (Decimal), e sommarli in JS può produrre errore di virgola
// mobile (es. 0.1 + 0.2 !== 0.3). Applicato ai punti individuati
// dall'audit: la soglia del bollo (lib/validations/invoice.ts, già coperta
// anche da verify:invoice-bollo-threshold) e {{fattura.totaleConBollo}}
// (lib/pdf/placeholders.ts). Questo script verifica prima la funzione di
// arrotondamento in isolamento, poi un caso concreto in cui il drift in
// virgola mobile avrebbe potuto spostare il confronto con SOGLIA_BOLLO sul
// lato sbagliato senza l'arrotondamento.

const failures: string[] = [];

function assertEqual(actual: number, expected: number, message: string): void {
  if (actual !== expected) {
    failures.push(`${message} — atteso ${expected}, ottenuto ${actual}`);
  }
}

function testRoundCurrencyEliminaDrift(): void {
  const drift = 0.1 + 0.2; // 0.30000000000000004 in IEEE 754
  if (drift === 0.3) {
    failures.push(
      "Precondizione del test non verificata: 0.1 + 0.2 risulta esatto in questo runtime, il test non è significativo"
    );
    return;
  }
  assertEqual(roundCurrency(drift), 0.3, "roundCurrency deve eliminare il drift di 0.1 + 0.2");
  assertEqual(roundCurrency(79.47000000001), 79.47, "roundCurrency deve arrotondare a 2 decimali");
  assertEqual(roundCurrency(0), 0, "roundCurrency(0) deve restare 0");
}

function testSogliaBolloResisteAlDriftSuPiuMesi(): void {
  // Tre mesi la cui somma matematica è esattamente SOGLIA_BOLLO (77.47), ma
  // che sommati in virgola mobile IEEE 754 danno 77.47000000000001: senza
  // roundCurrency il confronto `totale > SOGLIA_BOLLO` nel superRefine di
  // invoiceSchema risulterebbe `true` per un errore di arrotondamento di un
  // centesimo di centesimo, non perché il totale superi davvero la soglia.
  const mesi = [
    { mese: "GENNAIO", prezzo: 0.01 },
    { mese: "FEBBRAIO", prezzo: 0.03 },
    { mese: "MARZO", prezzo: 77.43 },
  ];
  const sommaGrezza = mesi.reduce((s, m) => s + m.prezzo, 0);
  if (sommaGrezza === SOGLIA_BOLLO) {
    failures.push(
      "Precondizione del test non verificata: la somma grezza in virgola mobile risulta già esatta in questo runtime, il test non è significativo"
    );
    return;
  }

  const result = invoiceSchema.safeParse({
    id_Pagante: 1,
    id_Paziente: 1,
    data: "2026-01-01",
    mod_pag: "CONTANTI" as const,
    n_fattura: 1,
    citta: "Roma",
    cap: "00100",
    mesi,
    bolloCodice: "",
  });

  if (!result.success) {
    failures.push(
      `Totale esattamente pari a SOGLIA_BOLLO (sommato con drift in virgola mobile) senza bolloCodice deve essere accettato — rifiutato: ${JSON.stringify(result.error)}`
    );
  }
}

testRoundCurrencyEliminaDrift();
testSogliaBolloResisteAlDriftSuPiuMesi();

if (failures.length > 0) {
  console.error("verify-currency-rounding: FALLITO");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  "roundCurrency elimina l'errore di virgola mobile e il confronto con SOGLIA_BOLLO resiste al drift su somme multi-mese."
);
