// Difesa in profondità da formula/CSV injection (OWASP): un valore che
// inizia con uno di questi caratteri può essere interpretato come formula
// da Excel/LibreOffice o da un importatore a valle all'apertura del file,
// anche quando proviene da un campo anagrafico in teoria innocuo (es. il
// cognome di un pagante).
// SEC-09: I fogli di calcolo scartano automaticamente gli spazi bianchi e caratteri
// di spaziatura iniziali prima di valutare una formula. Pertanto, verifichiamo sia
// il primo carattere grezzo sia il primo carattere significativo dopo trimStart().
// Anteporre un apice forza l'interpretazione come testo letterale senza alterare
// alcun valore legittimo: nessun cognome/via/commento reale inizia con questi caratteri.
const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function sanitizeCellValue(value: string): string {
  if (value.length === 0) return value;
  if (value[0] === "'") return value;
  if (FORMULA_TRIGGER_CHARS.has(value[0])) return `'${value}`;

  // Se ci sono spazi all'inizio, verifichiamo il primo carattere dopo gli spazi
  const withoutSpaces = value.replace(/^[ \u00a0]+/, "");
  if (withoutSpaces.length === 0) return value;
  if (withoutSpaces[0] === "'") return value;
  if (FORMULA_TRIGGER_CHARS.has(withoutSpaces[0])) return `'${value}`;

  // Se ci sono altri caratteri di spaziatura (es. newline, tabulazioni miste) prima di una formula
  const trimmed = value.trimStart();
  if (trimmed.length === 0) return value;
  if (trimmed[0] === "'") return value;
  if (FORMULA_TRIGGER_CHARS.has(trimmed[0])) return `'${value}`;

  return value;
}
