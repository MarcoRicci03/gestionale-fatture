export interface ErroreDocumentoTs {
  codiceErrore: string;
  tipo: "ERRORE" | "WARNING";
  descrizione: string;
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

    if (cols.length >= 11) {
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

    const tipo: "ERRORE" | "WARNING" = codErr.toUpperCase().startsWith("W")
      ? "WARNING"
      : "ERRORE";
    if (!map.has(numDoc)) map.set(numDoc, []);
    map.get(numDoc)!.push({ codiceErrore: codErr, tipo, descrizione: desc });
  }
  return map;
}

