import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { buildVociSpesa } from "@/lib/sistemats/payload-builder";
import { calcolaTotaliFattura } from "@/lib/fiscal/bollo";

// ARCH-06 / SMELL-10: Verifica statica ed architetturale dell'eliminazione
// della discrepanza tra importo bollo PDF e tracciato XML Sistema TS,
// e verifica del blocco trasmissione per fatture prive di marca da bollo.

const ROOT_DIR = join(__dirname, "..");
const BOLLO_FISCAL_PATH = join(ROOT_DIR, "lib", "fiscal", "bollo.ts");
const PAYLOAD_BUILDER_PATH = join(ROOT_DIR, "lib", "sistemats", "payload-builder.ts");
const PLACEHOLDERS_PATH = join(ROOT_DIR, "lib", "pdf", "placeholders.ts");
const TRANSMISSION_SERVICE_PATH = join(ROOT_DIR, "lib", "sistemats", "services", "transmission.service.ts");
const DATA_SISTEMA_TS_PATH = join(ROOT_DIR, "lib", "data", "sistema-ts.ts");

describe("ARCH-06 / SMELL-10: Analisi statica e invarianti del bollo", () => {
  it("il modulo di dominio lib/fiscal/bollo.ts esiste ed esporta le funzioni centralizzate", () => {
    expect(existsSync(BOLLO_FISCAL_PATH)).toBe(true);
    const source = readFileSync(BOLLO_FISCAL_PATH, "utf-8");
    expect(source).toMatch(/export\s+function\s+calcolaTotaliFattura\s*\(/);
    expect(source).toMatch(/export\s+function\s+isBolloDovuto\s*\(/);
    expect(source).toMatch(/export\s+function\s+isBolloApplicato\s*\(/);
    expect(source).toMatch(/export\s+function\s+isBolloCodiceValido\s*\(/);
  });

  it("lib/sistemats/payload-builder.ts non aggiunge il bollo solo sulla base del totale ma verifica isBolloApplicato", () => {
    const source = readFileSync(PAYLOAD_BUILDER_PATH, "utf-8");
    expect(source).toMatch(/import\s*\{[^}]*isBolloApplicato[^}]*\}\s*from\s*["']@\/lib\/fiscal\/bollo["']/);
    expect(source).toContain("isBolloApplicato(params.bolloCodice)");
    expect(source).not.toContain("params.prezzoTotale > SOGLIA_BOLLO ||");
  });

  it("lib/pdf/placeholders.ts utilizza calcolaTotaliFattura per i placeholder del bollo e totale", () => {
    const source = readFileSync(PLACEHOLDERS_PATH, "utf-8");
    expect(source).toMatch(/import\s*\{[^}]*calcolaTotaliFattura[^}]*\}\s*from\s*["']@\/lib\/fiscal\/bollo["']/);
    expect(source).toContain("calcolaTotaliFattura(invoice.prezzo_totale, invoice.bolloCodice)");
  });

  it("lib/sistemats/services/transmission.service.ts blocca la trasmissione se la fattura supera la soglia ed è priva di codice", () => {
    const source = readFileSync(TRANSMISSION_SERVICE_PATH, "utf-8");
    expect(source).toMatch(/isBolloDovuto/);
    expect(source).toMatch(/isBolloCodiceValido/);
    expect(source).toContain("isBolloDovuto(prezzoTotale) && !isBolloCodiceValido(inv.bolloCodice)");
  });

  it("lib/data/sistema-ts.ts include bolloMancante in haAnomalie (SMELL-10)", () => {
    const source = readFileSync(DATA_SISTEMA_TS_PATH, "utf-8");
    expect(source).toMatch(/haAnomalie\s*=\s*!cfValido\s*\|\|\s*!importoValido\s*\|\|\s*bolloMancante/);
  });

  it("invariante matematico: la somma di vociSpesa XML coincide SEMPRE con totaleConBollo per qualunque fattura", () => {
    const testCases = [
      { prezzoTotale: 50, bolloCodice: null },
      { prezzoTotale: 50, bolloCodice: "01202600001234" },
      { prezzoTotale: 100, bolloCodice: null },
      { prezzoTotale: 100, bolloCodice: "01202600001234" },
      { prezzoTotale: 77.47, bolloCodice: null },
      { prezzoTotale: 77.48, bolloCodice: "01202600001234" },
    ];

    for (const tc of testCases) {
      const voci = buildVociSpesa({
        prezzoTotale: tc.prezzoTotale,
        bolloCodice: tc.bolloCodice,
      });
      const sommaVociXml = voci.reduce((acc, v) => acc + v.importo, 0);
      const totali = calcolaTotaliFattura(tc.prezzoTotale, tc.bolloCodice);

      expect(sommaVociXml).toBeCloseTo(totali.totaleConBollo, 2);
    }
  });
});
