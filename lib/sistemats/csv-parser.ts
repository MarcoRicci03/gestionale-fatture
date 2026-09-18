export interface ErroreDocumentoTs {
  codiceErrore: string;
  tipo: "ERRORE" | "WARNING";
  descrizione: string;
  numDocumento?: string;
  dataEmissione?: string;
  anno?: number;
}

function extractYear(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const trimmed = dateStr.trim();
  // Formato italiano: DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = trimmed.match(/^\d{1,2}[/-]\d{1,2}[/-](\d{4})$/);
  if (dmyMatch) return parseInt(dmyMatch[1], 10);
  // Formato ISO: YYYY-MM-DD o YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[/-]\d{1,2}[/-]\d{1,2}$/);
  if (ymdMatch) return parseInt(ymdMatch[1], 10);
  // Fallback per anno a 4 cifre
  const anyYearMatch = trimmed.match(/\b(20\d{2})\b/);
  if (anyYearMatch) return parseInt(anyYearMatch[1], 10);
  return undefined;
}

function isHeaderRow(cols: string[]): boolean {
  if (cols.length >= 11) {
    if (/^\d+$/.test(cols[7])) return false;
    const sample = `${cols[0]} ${cols[7]} ${cols[9]}`.toLowerCase();
    return (
      sample.includes("documento") ||
      sample.includes("proprietario") ||
      sample.includes("codice") ||
      sample.includes("errore")
    );
  }
  if (cols.length >= 3) {
    if (/^\d+$/.test(cols[0])) return false;
    const col0 = cols[0].toLowerCase();
    const col1 = cols[1].toLowerCase();
    return (
      /^(num|doc|prog|id|fatt|n_)/.test(col0) ||
      /^(cod|err)/.test(col1)
    );
  }
  return false;
}

/**
 * Esegue il parsing del tracciato CSV degli errori / segnalazioni restituito
 * dal servizio ministeriale DettaglioErrori730Service del Sistema TS.
 * Mappa ciascuna anomalia al relativo numero progressivo di documento fiscale.
 */
export function parseCsvErroriTs(
  csvText?: string | null
): Map<string, ErroreDocumentoTs[]> {
  const map = new Map<string, ErroreDocumentoTs[]>();
  if (!csvText) return map;

  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(";").map((c) => c.trim());
    if (isHeaderRow(cols)) continue;

    let numDoc = "";
    let codErr = "";
    let desc = "";
    let dataEmissioneRaw: string | undefined = undefined;

    if (cols.length >= 11) {
      dataEmissioneRaw = cols[5] || undefined;
      numDoc = cols[7];
      codErr = cols[9];
      desc = cols[10];
    } else if (cols.length >= 3) {
      numDoc = cols[0];
      codErr = cols[1];
      desc = cols[2];
    } else {
      continue;
    }

    if (!numDoc || !codErr) continue;

    const anno = extractYear(dataEmissioneRaw);
    const tipo: "ERRORE" | "WARNING" = codErr.toUpperCase().startsWith("W")
      ? "WARNING"
      : "ERRORE";

    if (!map.has(numDoc)) map.set(numDoc, []);
    map.get(numDoc)!.push({
      codiceErrore: codErr,
      tipo,
      descrizione: desc,
      numDocumento: numDoc,
      dataEmissione: dataEmissioneRaw,
      anno,
    });
  }
  return map;
}

/**
 * Recupera le anomalie associate a una specifica fattura identificata da n_fattura e (opzionalmente) anno/data.
 * Se nel CSV è presente l'anno di emissione, filtra rigorosamente per corrispondenza di anno,
 * prevenendo collisioni tra fatture con lo stesso progressivo in anni solari differenti.
 */
export function getErrorsForInvoice(
  errorsMap: Map<string, ErroreDocumentoTs[]>,
  invoice: { n_fattura: number | string; anno?: number | null; data?: Date | string | null }
): ErroreDocumentoTs[] {
  const numDocStr = String(invoice.n_fattura).trim();
  const errors = errorsMap.get(numDocStr);
  if (!errors || errors.length === 0) return [];

  const invoiceYear =
    invoice.anno ??
    (invoice.data
      ? (typeof invoice.data === "string"
          ? extractYear(invoice.data)
          : invoice.data.getFullYear())
      : undefined);

  if (!invoiceYear) return errors;

  const hasYearInfo = errors.some((e) => e.anno !== undefined);
  if (!hasYearInfo) {
    return errors;
  }

  return errors.filter((e) => e.anno === undefined || e.anno === invoiceYear);
}

