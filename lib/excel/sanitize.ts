// Difesa in profondità da formula/CSV injection (OWASP): un valore che
// inizia con uno di questi caratteri può essere interpretato come formula
// da Excel/LibreOffice o da un importatore a valle all'apertura del file,
// anche quando proviene da un campo anagrafico in teoria innocuo (es. il
// cognome di un pagante). Anteporre un apice forza l'interpretazione come
// testo letterale senza alterare alcun valore legittimo: nessun
// cognome/via/commento reale inizia con questi caratteri.
const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function sanitizeCellValue(value: string): string {
  if (value.length === 0) return value;
  if (value[0] === "'") return value;
  return FORMULA_TRIGGER_CHARS.has(value[0]) ? `'${value}` : value;
}
