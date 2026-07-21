import { invoiceSchema } from "../lib/validations/invoice";
import { MESI } from "../lib/constants/mesi";

// Regressione LOG-07: mesi[] non aveva né un tetto di lunghezza né un
// controllo di unicità sul mese. Due righe con lo stesso mese violano
// @@unique([id_Pagamento, mese]) su FatturaMese: l'eccezione P2002 non era
// intercettata e l'utente vedeva il generico "Errore durante la creazione
// della fattura". Non raggiungibile dal form web (12 checkbox, una per
// mese, guidate da un Set), ma raggiungibile chiamando createInvoice/
// updateInvoice direttamente. Questo script verifica che invoiceSchema
// rifiuti ora sia un array oltre 12 elementi sia mesi duplicati sotto quel
// tetto, con un messaggio esplicito in entrambi i casi.

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

function withMesi(mesi: { mese: string; prezzo: number }[]) {
  return { ...baseInvoice, mesi };
}

// Prezzo volutamente basso (LOG-01/SOGLIA_BOLLO): questi test riguardano
// solo il numero/l'unicità dei mesi, non la logica del bollo.
function testOltreDodiciMesiRifiutato(): void {
  const tredici = [...MESI, MESI[0]].map((mese) => ({ mese, prezzo: 1 }));
  assertRejects(
    invoiceSchema.safeParse(withMesi(tredici)),
    "Array di 13 elementi (12 distinti + 1 ripetuto) deve essere rifiutato (max 12)"
  );
}

function testEsattamenteDodiciMesiDistintiAccettato(): void {
  const dodici = MESI.map((mese) => ({ mese, prezzo: 1 }));
  assertAccepts(
    invoiceSchema.safeParse(withMesi(dodici)),
    "Array di esattamente 12 mesi distinti deve essere accettato"
  );
}

function testMeseRipetutoSottoDodiciRifiutato(): void {
  assertRejects(
    invoiceSchema.safeParse(
      withMesi([
        { mese: "GENNAIO", prezzo: 10 },
        { mese: "GENNAIO", prezzo: 10 },
      ])
    ),
    "Due righe con lo stesso mese (array di 2, sotto il tetto di 12) deve essere rifiutato"
  );
}

function testMesiDistintiCasoBaseAccettato(): void {
  assertAccepts(
    invoiceSchema.safeParse(
      withMesi([
        { mese: "GENNAIO", prezzo: 10 },
        { mese: "FEBBRAIO", prezzo: 10 },
        { mese: "MARZO", prezzo: 10 },
      ])
    ),
    "Tre mesi distinti (caso base) deve essere accettato"
  );
}

testOltreDodiciMesiRifiutato();
testEsattamenteDodiciMesiDistintiAccettato();
testMeseRipetutoSottoDodiciRifiutato();
testMesiDistintiCasoBaseAccettato();

if (failures.length > 0) {
  console.error("verify-invoice-mesi-limits: FALLITO");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  "invoiceSchema rifiuta correttamente array di mesi oltre 12 elementi e mesi duplicati."
);
