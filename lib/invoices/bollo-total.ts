import { IMPORTO_BOLLO } from "@/lib/constants/bollo";

// Il bollo si somma al totale mostrato SOLO quando bolloCodice è
// effettivamente presente, non quando è solo "dovuto" per soglia superata
// (vedi bollo_dovuto in lib/excel/column-catalog.ts, che guarda invece
// prezzo_totale > SOGLIA_BOLLO): il bollo è un costo realmente sostenuto
// solo una volta apposto/registrato il codice. `prezzo_totale` in DB non
// include mai questo importo (resta la somma pura dei mesi, vedi
// lib/actions/invoices.ts) — queste funzioni servono solo per la
// visualizzazione (form, tabella/dialog fatture, export Excel).
export function getBolloImporto(bolloCodice: string | null | undefined): number {
  return bolloCodice ? IMPORTO_BOLLO : 0;
}

export function getTotaleConBollo(
  prezzoTotale: number,
  bolloCodice: string | null | undefined
): number {
  return prezzoTotale + getBolloImporto(bolloCodice);
}
