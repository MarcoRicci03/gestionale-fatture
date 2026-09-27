import { SOGLIA_BOLLO, IMPORTO_BOLLO, BOLLO_CODICE_REGEX } from "@/lib/constants/bollo";
import { roundCurrency } from "@/lib/utils/currency";

export { SOGLIA_BOLLO, IMPORTO_BOLLO, BOLLO_CODICE_REGEX };

export interface TotaliFattura {
  prezzoTotale: number;
  bolloImporto: number;
  totaleConBollo: number;
  bolloDovuto: boolean;
  bolloApplicato: boolean;
  bolloMancante: boolean;
}

/**
 * ARCH-06: Verifica se la marca da bollo è dovuta per legge (importo > 77.47 €).
 */
export function isBolloDovuto(prezzoTotale: number): boolean {
  return prezzoTotale > SOGLIA_BOLLO;
}

/**
 * ARCH-06: Verifica se il bollo è effettivamente applicato sulla fattura (codice presente non vuoto).
 */
export function isBolloApplicato(bolloCodice: string | null | undefined): boolean {
  return Boolean(bolloCodice && bolloCodice.trim().length > 0);
}

/**
 * ARCH-06: Verifica se il codice della marca da bollo rispetta il formato a 14 cifre numeriche.
 */
export function isBolloCodiceValido(bolloCodice: string | null | undefined): boolean {
  return Boolean(bolloCodice && BOLLO_CODICE_REGEX.test(bolloCodice.trim()));
}

/**
 * ARCH-06: Centralizza il calcolo dei totali fattura e dell'imposta di bollo,
 * garantendo che PDF, export Excel e tracciato XML ministeriale Sistema TS operino
 * con la medesima business logic e non divergano mai.
 */
export function calcolaTotaliFattura(
  prezzoTotale: number,
  bolloCodice?: string | null
): TotaliFattura {
  const dovuto = isBolloDovuto(prezzoTotale);
  const applicato = isBolloApplicato(bolloCodice);
  const bolloImporto = applicato ? IMPORTO_BOLLO : 0;
  return {
    prezzoTotale,
    bolloImporto,
    totaleConBollo: roundCurrency(prezzoTotale + bolloImporto),
    bolloDovuto: dovuto,
    bolloApplicato: applicato,
    bolloMancante: dovuto && !applicato,
  };
}

/**
 * Restituisce l'importo del bollo applicato (2.00 € se codice presente, 0 altrimenti).
 */
export function getBolloImporto(bolloCodice: string | null | undefined): number {
  return isBolloApplicato(bolloCodice) ? IMPORTO_BOLLO : 0;
}

/**
 * Restituisce il totale complessivo della fattura comprensivo del bollo applicato.
 */
export function getTotaleConBollo(
  prezzoTotale: number,
  bolloCodice: string | null | undefined
): number {
  return calcolaTotaliFattura(prezzoTotale, bolloCodice).totaleConBollo;
}
