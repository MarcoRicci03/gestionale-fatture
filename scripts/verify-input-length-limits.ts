import { invoiceSchema } from "../lib/validations/invoice";
import { patientSchema } from "../lib/validations/patient";
import { payerSchema } from "../lib/validations/payer";
import { profileUpdateSchema } from "../lib/validations/profile";
import { pdfSettingsSchema, bloccoSchema } from "../lib/validations/pdf-settings";

// Regressione SEC-11: diversi campi testuali accettavano stringhe di
// lunghezza arbitraria (nessun .max()), e i blob "ricchi" dell'editor PDF
// (richContent/descrizioneRichContent/valoreRichContent) erano JSON opachi
// senza alcun tetto di dimensione. Un client autenticato poteva scrivere
// payload enormi e ripeterlo, gonfiando il DB senza limite. Questo script
// verifica che ogni campo interessato rifiuti un input oltre soglia.

const failures: string[] = [];

function assertRejects(
  result: { success: boolean },
  message: string
): void {
  if (result.success) {
    failures.push(`${message} — atteso il rifiuto, l'input è stato accettato`);
  }
}

function assertAccepts(
  result: { success: boolean },
  message: string
): void {
  if (!result.success) {
    failures.push(`${message} — atteso l'accettazione, l'input è stato rifiutato`);
  }
}

const baseValidInvoice = {
  id_Pagante: 1,
  id_Paziente: 1,
  data: "2026-01-01",
  mod_pag: "CONTANTI" as const,
  n_fattura: 1,
  // Prezzo volutamente sotto SOGLIA_BOLLO (LOG-01): questi test riguardano
  // solo i limiti di lunghezza dei campi testuali, non la logica del bollo.
  mesi: [{ mese: "GENNAIO", prezzo: 50 }],
  citta: "Roma",
  cap: "00100",
};

function testInvoiceFieldLimits(): void {
  assertRejects(
    invoiceSchema.safeParse({ ...baseValidInvoice, commento: "x".repeat(2001) }),
    "invoiceSchema.commento oltre 2000 caratteri deve essere rifiutato"
  );
  assertAccepts(
    invoiceSchema.safeParse({ ...baseValidInvoice, commento: "x".repeat(2000) }),
    "invoiceSchema.commento a 2000 caratteri deve essere accettato"
  );
  assertRejects(
    invoiceSchema.safeParse({ ...baseValidInvoice, citta: "x".repeat(101) }),
    "invoiceSchema.citta oltre 100 caratteri deve essere rifiutato"
  );
  assertRejects(
    invoiceSchema.safeParse({ ...baseValidInvoice, cap: "x".repeat(11) }),
    "invoiceSchema.cap oltre 10 caratteri deve essere rifiutato"
  );
}

function testPatientFieldLimits(): void {
  assertRejects(
    patientSchema.safeParse({ nome: "x".repeat(101), cognome: "Rossi" }),
    "patientSchema.nome oltre 100 caratteri deve essere rifiutato"
  );
  assertRejects(
    patientSchema.safeParse({ nome: "Mario", cognome: "x".repeat(101) }),
    "patientSchema.cognome oltre 100 caratteri deve essere rifiutato"
  );
}

function testPayerFieldLimits(): void {
  const basePayer = {
    nome: "Mario",
    cognome: "Rossi",
    via: "Via Roma 1",
    citta: "Roma",
    cap: "00100",
    cf: "RSSMRA80A01H501Z",
  };
  assertRejects(
    payerSchema.safeParse({ ...basePayer, via: "x".repeat(201) }),
    "payerSchema.via oltre 200 caratteri deve essere rifiutato"
  );
  assertRejects(
    payerSchema.safeParse({ ...basePayer, citta: "x".repeat(101) }),
    "payerSchema.citta oltre 100 caratteri deve essere rifiutato"
  );
}

function testProfileFieldLimits(): void {
  assertRejects(
    profileUpdateSchema.safeParse({ nome: "x".repeat(101) }),
    "profileUpdateSchema.nome oltre 100 caratteri deve essere rifiutato"
  );
  assertRejects(
    profileUpdateSchema.safeParse({ specializzazione: "x".repeat(101) }),
    "profileUpdateSchema.specializzazione oltre 100 caratteri deve essere rifiutato"
  );
}

function makeBlocco(overrides: Record<string, unknown> = {}) {
  return {
    id: "blocco-1",
    tipo: "testo",
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    fontSize: 11,
    align: "left",
    visible: true,
    ...overrides,
  };
}

function testBloccoFieldLimits(): void {
  assertRejects(
    bloccoSchema.safeParse(makeBlocco({ testo: "x".repeat(10_001) })),
    "bloccoSchema.testo oltre 10000 caratteri deve essere rifiutato"
  );
  assertAccepts(
    bloccoSchema.safeParse(makeBlocco({ testo: "x".repeat(10_000) })),
    "bloccoSchema.testo a 10000 caratteri deve essere accettato"
  );

  // richContent è un blob opaco (z.unknown()): il limite è sulla dimensione
  // serializzata, non sulla forma. Un array abbastanza grande da superare i
  // 50_000 caratteri una volta serializzato deve essere rifiutato.
  const hugeRichContent = {
    type: "doc",
    content: Array.from({ length: 5000 }, () => ({
      type: "text",
      text: "0123456789",
    })),
  };
  assertRejects(
    bloccoSchema.safeParse(makeBlocco({ richContent: hugeRichContent })),
    "bloccoSchema.richContent oltre la soglia di dimensione serializzata deve essere rifiutato"
  );
  assertAccepts(
    bloccoSchema.safeParse(
      makeBlocco({ richContent: { type: "doc", content: [{ type: "text", text: "ok" }] } })
    ),
    "bloccoSchema.richContent di dimensione normale deve essere accettato"
  );
}

function testBlocchiArrayCap(): void {
  const basePdfSettings = {
    fontFamily: "Helvetica",
  };

  const tooManyBlocchi = Array.from({ length: 501 }, (_, i) =>
    makeBlocco({ id: `blocco-${i}` })
  );
  assertRejects(
    pdfSettingsSchema.safeParse({ ...basePdfSettings, blocchi: tooManyBlocchi }),
    "pdfSettingsSchema.blocchi con più di 500 elementi deve essere rifiutato"
  );

  const exactlyMaxBlocchi = Array.from({ length: 500 }, (_, i) =>
    makeBlocco({ id: `blocco-${i}` })
  );
  assertAccepts(
    pdfSettingsSchema.safeParse({ ...basePdfSettings, blocchi: exactlyMaxBlocchi }),
    "pdfSettingsSchema.blocchi con esattamente 500 elementi (>100, come richiesto) deve essere accettato"
  );
}

testInvoiceFieldLimits();
testPatientFieldLimits();
testPayerFieldLimits();
testProfileFieldLimits();
testBloccoFieldLimits();
testBlocchiArrayCap();

if (failures.length > 0) {
  console.error("verify-input-length-limits: FALLITO");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  "Tutti i campi testuali e i blob rich-text controllati rispettano i limiti di lunghezza attesi."
);
