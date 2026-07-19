import { parseTestoToRichContent, serializeRichContentToTesto } from "../lib/pdf/rich-text";
import { LAYOUT_DEFAULT } from "../lib/pdf/layout-default";

const fixtures: string[] = [];
for (const b of LAYOUT_DEFAULT.blocchi) {
  if (b.testo) fixtures.push(b.testo);
}

const extra = [
  "Testo libero",
  "Mittente\n{{mittente.titoloNomeCognomeSpec}}\n{{mittente.via}}\n{{mittente.cittaProvincia}}\nCF: {{mittente.cf}}\nP.IVA: {{mittente.pIva}}",
  "Intestatario fattura (Pagante)\n{{intestatario.cognomeNome}}\n{{intestatario.via}}\n{{intestatario.capCitta}}\nCF: {{intestatario.cf}}\nP.IVA: {{intestatario.piva}}",
  "Paziente\n{{paziente.cognomeNome}}",
  "Dettagli pagamento\nImporto totale:\t{{fattura.prezzoTotale}}\nModalità:\t{{fattura.modalitaPagamento}}\nN. sedute:\t{{fattura.sedute}}\nNote:\t{{fattura.commento}}",
  "<b>Grassetto</b> normale <i>corsivo</i> e <note>nota</note> con {{fattura.numero}} inline",
  "",
  "Riga senza placeholder ne formattazione",
  "{{placeholder.sconosciuto}} orfano",
  "<b>{{fattura.numero}}</b> normale",
  "Prezzo: <i>{{fattura.prezzoTotale}}</i> e <note>{{fattura.commento}}</note>",
];
fixtures.push(...extra);

let failures = 0;
for (const original of fixtures) {
  const doc = parseTestoToRichContent(original);
  const roundTripped = serializeRichContentToTesto(doc);
  if (roundTripped !== original) {
    failures++;
    console.error("MISMATCH");
    console.error("  original: ", JSON.stringify(original));
    console.error("  roundtrip:", JSON.stringify(roundTripped));
  }
}

console.log(`Checked ${fixtures.length} fixtures, ${failures} mismatches.`);
if (failures > 0) process.exit(1);
