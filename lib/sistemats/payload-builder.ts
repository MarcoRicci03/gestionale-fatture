import { SOGLIA_BOLLO, IMPORTO_BOLLO } from "@/lib/constants/bollo";
import type { VoceSpesaPayload } from "./types";

/**
 * Limiti imposti dallo schema XSD 730_precompilata.xsd (Dec7MinTipo: totalDigits 7, fractionDigits 2, minInclusive 0.01).
 * Ciascun importo deve essere compreso tra 0.01 € e 99.999,99 €.
 */
export const SISTEMATS_IMPORTO_MIN = 0.01;
export const SISTEMATS_IMPORTO_MAX = 99999.99;

/**
 * Valida che un importo sia conforme ai vincoli dimensionali e di positività dello schema XSD Sogei (Dec7MinTipo).
 */
export function validateImportoSpesa(importo: number | null | undefined): {
  valid: boolean;
  error?: string;
} {
  if (importo === null || importo === undefined || isNaN(importo)) {
    return { valid: false, error: "Importo non specificato o non valido" };
  }

  if (importo < SISTEMATS_IMPORTO_MIN) {
    return {
      valid: false,
      error: `L'importo (${importo.toFixed(2)} €) deve essere maggiore di zero (minimo 0,01 € per tracciato Sistema TS)`,
    };
  }

  if (importo > SISTEMATS_IMPORTO_MAX) {
    return {
      valid: false,
      error: `L'importo (${importo.toFixed(2)} €) supera il limite massimo consentito dallo schema ministeriale (99.999,99 €)`,
    };
  }

  return { valid: true };
}

/**
 * Determina la corretta natura IVA per la marca da bollo:
 * - Per il Regime Ordinario (prestazione esente art. 10 DPR 633/72 con natura "N4"):
 *   l'imposta di bollo è esclusa dalla base imponibile ex art. 15 comma 1 n. 3 DPR 633/72 -> "N1".
 * - Per il Regime Forfettario (L. 190/2014 con natura "N2.2" o default):
 *   ai sensi dell'Interpello Agenzia delle Entrate n. 428/2022, il bollo concorre al compenso
 *   e deve seguire la medesima natura IVA della prestazione principale -> "N2.2".
 */
export function resolveNaturaIvaBollo(naturaIva?: string | null): string {
  if (naturaIva === "N4") {
    return "N1";
  }
  return "N2.2";
}

/**
 * Costruisce l'elenco delle voci di spesa (voceSpesa) per il documento Sistema TS:
 * - Voce 1: prestazione sanitaria con tipoSpesa "SP", importo totale e natura IVA della fattura (default "N2.2").
 * - Voce 2 (se dovuta): marca da bollo da 2.00 € con tipoSpesa "SP" e natura IVA determinata
 *   dinamicamente in base al regime fiscale (N2.2 per forfettari, N1 per ordinari esenti art. 10).
 */
export function buildVociSpesa(params: {
  prezzoTotale: number;
  naturaIva?: string | null;
  bolloCodice?: string | null;
}): VoceSpesaPayload[] {
  const voci: VoceSpesaPayload[] = [
    {
      tipoSpesa: "SP",
      importo: params.prezzoTotale,
      naturaIva: params.naturaIva || "N2.2",
    },
  ];

  if (params.prezzoTotale > SOGLIA_BOLLO || Boolean(params.bolloCodice)) {
    voci.push({
      tipoSpesa: "SP",
      importo: IMPORTO_BOLLO,
      naturaIva: resolveNaturaIvaBollo(params.naturaIva),
    });
  }

  return voci;
}
