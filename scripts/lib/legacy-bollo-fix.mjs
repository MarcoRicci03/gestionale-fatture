// JS puro (non .ts): scripts/fix-legacy-bollo-invoices.mjs lo importa a
// runtime nell'immagine di produzione, dove npm prune --omit=dev ha già
// rimosso tsx/typescript (stesso motivo di scripts/lib/retention-schedule.mjs
// e prisma/seed.mjs).
//
// Contesto: le fatture importate dal vecchio gestionale hanno prezzo_totale
// (e l'unico FatturaMese collegato) con i 2€ di marca da bollo già sommati
// dentro quando l'importo superava SOGLIA_BOLLO, ma senza che il codice
// seriale del bollo sia mai stato tracciato (bolloCodice sempre NULL). Nel
// gestionale attuale prezzo_totale è invece sempre l'importo puro, e i 2€
// vengono sommati solo in visualizzazione quando bolloCodice è valorizzato
// (lib/invoices/bollo-total.ts). Questo modulo isola la logica pura,
// testabile senza un database, usata dallo script di correzione una tantum.

const SOGLIA_BOLLO = 77.47;

// "9999" è un prefisso deliberatamente non plausibile come vero seriale
// Agenzia Entrate/Poste (che hanno una propria numerazione), per restare
// riconoscibile come segnaposto in qualunque esportazione/stampa futura. Il
// bollo reale è stato comprato e apposto per queste fatture (confermato),
// solo il suo codice non è mai stato tracciato nel vecchio sistema: se serve
// il dato reale va recuperato manualmente (carta/PEC/portale), non è
// ricostruibile da qui.
const PLACEHOLDER_PREFIX = "9999";

// Deve produrre esattamente 14 cifre numeriche (BOLLO_CODICE_REGEX in
// lib/constants/bollo.ts) e restare unico per fattura: `id` è la chiave
// primaria di Pagamento, quindi globalmente unico a prescindere da
// id_Utente — soddisfa banalmente @@unique([id_Utente, bolloCodice]).
export function buildLegacyBolloPlaceholder(id) {
  return `${PLACEHOLDER_PREFIX}${String(id).padStart(10, "0")}`;
}

// Una fattura è candidata alla correzione solo se TUTTE e tre le condizioni
// valgono insieme:
// - prezzo_totale supera la soglia bollo: solo lì il vecchio sistema
//   sommava i 2€;
// - bolloCodice è nullo: se è già valorizzato, la fattura è già corretta
//   (o è una fattura nuova con un bollo vero già registrato) — non va
//   ritoccata;
// - snapshotAnagrafica è nullo: valorizzato SEMPRE da createInvoice
//   (lib/actions/invoices.ts) alla creazione, incondizionatamente, e mai
//   azzerato da updateInvoice. Una fattura passata dall'app ha quindi
//   sempre questo campo non nullo — se è nullo, la riga non può essere mai
//   stata creata tramite l'app, quindi è un'importazione diretta nel
//   database. Senza questo controllo, una fattura NUOVA che supera la
//   soglia ma il cui bollo non è ancora stato acquistato/inserito (stato
//   valido e previsto, vedi bolloMancante in
//   components/invoices/invoice-form.tsx) avrebbe la stessa forma di una
//   riga storica da correggere, e sottrarle 2€ la corromperebbe (il suo
//   importo è già quello puro).
export function isLegacyBolloCandidate({
  snapshotAnagrafica,
  prezzoTotale,
  bolloCodice,
}) {
  return (
    snapshotAnagrafica == null &&
    prezzoTotale > SOGLIA_BOLLO &&
    bolloCodice == null
  );
}
