/**
 * Catalogo statico dei placeholder {{...}} disponibili nell'editor: label leggibile
 * per l'utente + valore grezzo da inserire nel testo. Usato sia dai bottoni della
 * sidebar dell'editor sia dal parser di compatibilità (rich-text-bridge.ts) per
 * risolvere il "label" di un chip a partire dal suo placeholder.
 */
export type PlaceholderGroup = {
  label: string;
  items: { label: string; value: string }[];
};

export const PLACEHOLDER_GROUPS: PlaceholderGroup[] = [
  {
    label: "Mittente",
    items: [
      {
        label: "Titolo, nome, cognome, spec.",
        value: "{{mittente.titoloNomeCognomeSpec}}",
      },
      { label: "Via", value: "{{mittente.via}}" },
      { label: "CAP", value: "{{mittente.cap}}" },
      { label: "Città e provincia", value: "{{mittente.cittaProvincia}}" },
      { label: "CAP, città e provincia", value: "{{mittente.capCittaProvincia}}" },
      { label: "Partita IVA", value: "{{mittente.pIva}}" },
      { label: "Codice fiscale", value: "{{mittente.cf}}" },
    ],
  },
  {
    label: "Intestatario",
    items: [
      { label: "Cognome e nome", value: "{{intestatario.cognomeNome}}" },
      { label: "Via", value: "{{intestatario.via}}" },
      { label: "CAP e città", value: "{{intestatario.capCitta}}" },
      { label: "CF o P.IVA", value: "{{intestatario.cfOppurePiva}}" },
      { label: "CF", value: "{{intestatario.cf}}" },
      { label: "P.IVA", value: "{{intestatario.piva}}" },
    ],
  },
  {
    label: "Paziente",
    items: [{ label: "Cognome e nome", value: "{{paziente.cognomeNome}}" }],
  },
  {
    label: "Fattura",
    items: [
      { label: "Numero", value: "{{fattura.numero}}" },
      { label: "Data", value: "{{fattura.data}}" },
      { label: "Importo totale", value: "{{fattura.prezzoTotale}}" },
      { label: "Modalità pagamento", value: "{{fattura.modalitaPagamento}}" },
      { label: "Sedute", value: "{{fattura.sedute}}" },
      { label: "Commento", value: "{{fattura.commento}}" },
      { label: "Città", value: "{{fattura.citta}}" },
      { label: "CAP", value: "{{fattura.cap}}" },
      { label: "Mesi", value: "{{fattura.mesi}}" },
      { label: "Codice marca da bollo", value: "{{fattura.bolloCodice}}" },
      { label: "Importo marca da bollo", value: "{{fattura.bolloImporto}}" },
      { label: "Riga marca da bollo (completa)", value: "{{fattura.bolloRiga}}" },
      { label: "Totale con marca da bollo", value: "{{fattura.totaleConBollo}}" },
    ],
  },
  {
    label: "Mese",
    items: [
      { label: "Nome mese/i", value: "{{mese.nome}}" },
      { label: "Anno", value: "{{mese.anno}}" },
    ],
  },
];

export const RIGA_MESE_GROUP: PlaceholderGroup = {
  label: "Riga mese",
  items: [
    { label: "Nome mese", value: "{{riga.meseLabel}}" },
    { label: "MESE", value: "{{riga.mese}}" },
    { label: "Prezzo", value: "{{riga.prezzo}}" },
    { label: "Prezzo (numero)", value: "{{riga.prezzoNumero}}" },
  ],
};

/** Cerca l'etichetta leggibile di un placeholder grezzo (es. "{{mittente.via}}" -> "Via"). */
export function findPlaceholderLabel(
  placeholder: string,
  extraGroups: PlaceholderGroup[] = []
): string | null {
  for (const group of [...extraGroups, ...PLACEHOLDER_GROUPS]) {
    const found = group.items.find((item) => item.value === placeholder);
    if (found) return found.label;
  }
  return null;
}
