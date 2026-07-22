import { it, expect } from "vitest";
import { parseTestoToRichContent, serializeRichContentToTesto } from "../lib/pdf/rich-text";
import { LAYOUT_DEFAULT } from "../lib/pdf/layout-default";

const fixtures: string[] = [];
for (const b of LAYOUT_DEFAULT.blocchi) {
  if (b.testo) fixtures.push(b.testo);
}

fixtures.push(
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
  "Prezzo: <i>{{fattura.prezzoTotale}}</i> e <note>{{fattura.commento}}</note>"
);

it.each(fixtures.map((original) => [original]))(
  "round-trip testo -> rich-content -> testo: %j",
  (original) => {
    const doc = parseTestoToRichContent(original);
    const roundTripped = serializeRichContentToTesto(doc);
    expect(roundTripped).toBe(original);
  }
);
