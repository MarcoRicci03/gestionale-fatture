import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false, // Preserva stringhe numeriche con zeri iniziali ("000", "00", "0")
  cdataPropName: false, // Estrae il contenuto CDATA direttamente come valore
});

/**
 * Parsa in modo sicuro una stringa XML SOAP in un oggetto JavaScript,
 * rimuovendo i prefissi di namespace e preservando tutti i valori come stringhe.
 * In caso di XML vuoto o malformato, restituisce `{}` senza sollevare eccezioni.
 */
export function parseXml(xml: string): Record<string, unknown> {
  if (!xml || typeof xml !== "string" || !xml.trim()) {
    return {};
  }
  try {
    const result = parser.parse(xml);
    return typeof result === "object" && result !== null ? result : {};
  } catch {
    return {};
  }
}

/**
 * Cerca ricorsivamente il valore foglia di un tag all'interno dell'albero XML parsato.
 * Il confronto del nome tag è case-insensitive per massima robustezza verso variazioni ministeriali.
 *
 * Supporta:
 * - Tag auto-chiusi (<tag />) che restituiscono stringa vuota ""
 * - Entità XML (&amp;, &lt;, &gt;, &quot;, &apos;) automaticamente decodificate
 * - Array di nodi o nodi annidati a profondità arbitraria
 */
export function findTagValue(
  node: unknown,
  tagName: string
): string | undefined {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  const target = tagName.toLowerCase();

  // Se il nodo è un array, cerca in ciascun elemento
  if (Array.isArray(node)) {
    for (const item of node) {
      const res = findTagValue(item, tagName);
      if (res !== undefined) return res;
    }
    return undefined;
  }

  const record = node as Record<string, unknown>;

  // 1. Cerca corrispondenza diretta tra le chiavi del livello corrente
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === target) {
      if (typeof value === "string") {
        return value.trim();
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      if (value === null || value === undefined) {
        return "";
      }
      // Tag auto-chiuso o vuoto: <tag /> o <tag></tag> (fast-xml-parser produce "" o {})
      if (typeof value === "object" && Object.keys(value as object).length === 0) {
        return "";
      }
      // Se il valore è un oggetto con sotto-chiavi (es. un contenitore padre <esito>),
      // non è una foglia: continua la ricerca per trovare eventuali nodi foglia omonimi
    }
  }

  // 2. Ricerca ricorsiva nei nodi figli
  for (const value of Object.values(record)) {
    if (typeof value === "object" && value !== null) {
      const found = findTagValue(value, tagName);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

/**
 * Helper di comodo: parsa una stringa XML ed estrae il valore del tag specificato.
 */
export function extractTagValueFromXml(
  xml: string,
  tagName: string
): string | undefined {
  const parsed = parseXml(xml);
  return findTagValue(parsed, tagName);
}
