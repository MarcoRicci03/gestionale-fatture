import { invoiceSchema } from "../lib/validations/invoice";
import { SOGLIA_BOLLO } from "../lib/constants/bollo";

// Regressione LOG-01: SOGLIA_BOLLO era applicata solo nel form client (un
// avviso non bloccante) — createInvoice/updateInvoice, chiamate direttamente
// come Server Action, salvavano fatture sopra soglia senza bolloCodice
// valorizzato, cioè documenti fiscalmente non conformi. Questo script
// verifica che invoiceSchema (usato sia dal client via zodResolver sia dalle
// Server Action) rifiuti ora un totale sopra soglia senza bolloCodice, e
// continui ad accettare i casi legittimi.

const failures: string[] = [];

function assertRejects(result: { success: boolean }, message: string): void {
  if (result.success) {
    failures.push(`${message} — atteso il rifiuto, l'input è stato accettato`);
  }
}

function assertAccepts(
  result: { success: boolean; error?: unknown },
  message: string
): void {
  if (!result.success) {
    failures.push(
      `${message} — atteso l'accettazione, l'input è stato rifiutato: ${JSON.stringify(
        "error" in result ? result.error : undefined
      )}`
    );
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

function testSopraSogliaSenzaBolloRifiutato(): void {
  assertRejects(
    invoiceSchema.safeParse({
      ...baseInvoice,
      mesi: [{ mese: "GENNAIO", prezzo: SOGLIA_BOLLO + 0.01 }],
      bolloCodice: "",
    }),
    "Totale appena sopra SOGLIA_BOLLO senza bolloCodice deve essere rifiutato"
  );
}

function testSopraSogliaConBolloAccettato(): void {
  assertAccepts(
    invoiceSchema.safeParse({
      ...baseInvoice,
      mesi: [{ mese: "GENNAIO", prezzo: SOGLIA_BOLLO + 0.01 }],
      bolloCodice: "12345678901234",
    }),
    "Totale sopra SOGLIA_BOLLO con bolloCodice valorizzato deve essere accettato"
  );
}

function testEsattamenteSogliaSenzaBolloAccettato(): void {
  // Il rimedio richiede il bollo solo quando il totale SUPERA la soglia
  // (> 77,47€), non quando la eguaglia — coerente con SOGLIA_BOLLO e con il
  // testo del form ("Il totale supera...").
  assertAccepts(
    invoiceSchema.safeParse({
      ...baseInvoice,
      mesi: [{ mese: "GENNAIO", prezzo: SOGLIA_BOLLO }],
      bolloCodice: "",
    }),
    "Totale esattamente pari a SOGLIA_BOLLO senza bolloCodice deve essere accettato"
  );
}

function testSottoSogliaSenzaBolloAccettato(): void {
  assertAccepts(
    invoiceSchema.safeParse({
      ...baseInvoice,
      mesi: [{ mese: "GENNAIO", prezzo: 10 }],
      bolloCodice: "",
    }),
    "Totale sotto SOGLIA_BOLLO senza bolloCodice deve essere accettato"
  );
}

function testSommaSuPiuMesiSopraSogliaSenzaBolloRifiutato(): void {
  // Il totale rilevante è la somma di tutti i mesi, non il prezzo di un
  // singolo mese: verifica che il refine sommi correttamente l'array.
  assertRejects(
    invoiceSchema.safeParse({
      ...baseInvoice,
      mesi: [
        { mese: "GENNAIO", prezzo: 40 },
        { mese: "FEBBRAIO", prezzo: 40 },
      ],
      bolloCodice: "",
    }),
    "Somma di più mesi sopra SOGLIA_BOLLO senza bolloCodice deve essere rifiutato"
  );
}

testSopraSogliaSenzaBolloRifiutato();
testSopraSogliaConBolloAccettato();
testEsattamenteSogliaSenzaBolloAccettato();
testSottoSogliaSenzaBolloAccettato();
testSommaSuPiuMesiSopraSogliaSenzaBolloRifiutato();

if (failures.length > 0) {
  console.error("verify-invoice-bollo-threshold: FALLITO");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  "invoiceSchema impone correttamente bolloCodice quando il totale supera SOGLIA_BOLLO."
);
