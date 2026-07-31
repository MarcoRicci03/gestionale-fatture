import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildLegacyBolloPlaceholder,
  isLegacyBolloCandidate,
} from "./legacy-bollo-fix.mjs";
import { SOGLIA_BOLLO } from "@/lib/constants/bollo";

// legacy-bollo-fix.mjs è JS puro (eseguibile anche nell'immagine di
// produzione senza TypeScript, stesso motivo di prisma/seed.mjs): non può
// importare lib/constants/bollo.ts, quindi SOGLIA_BOLLO vi è duplicata come
// costante locale. Stesso pattern di verify-seed-password-policy.test.ts:
// tiene le due soglie allineate per analisi statica del sorgente.
it("la soglia duplicata in legacy-bollo-fix.mjs coincide con SOGLIA_BOLLO", () => {
  const source = readFileSync(
    join(__dirname, "legacy-bollo-fix.mjs"),
    "utf-8"
  );
  const match = /SOGLIA_BOLLO\s*=\s*([\d.]+)/.exec(source);
  expect(match, "SOGLIA_BOLLO non trovata in legacy-bollo-fix.mjs").not.toBeNull();
  expect(Number(match![1])).toBe(SOGLIA_BOLLO);
});

describe("buildLegacyBolloPlaceholder", () => {
  it("produce sempre 14 cifre numeriche (BOLLO_CODICE_REGEX)", () => {
    expect(buildLegacyBolloPlaceholder(1)).toMatch(/^\d{14}$/);
    expect(buildLegacyBolloPlaceholder(42)).toMatch(/^\d{14}$/);
    expect(buildLegacyBolloPlaceholder(1234567890)).toMatch(/^\d{14}$/);
  });

  it("è distinto per ogni id (soddisfa @@unique([id_Utente, bolloCodice]))", () => {
    expect(buildLegacyBolloPlaceholder(1)).not.toBe(buildLegacyBolloPlaceholder(2));
  });

  it("usa il prefisso 9999, riconoscibile come segnaposto", () => {
    expect(buildLegacyBolloPlaceholder(42)).toBe("99990000000042");
  });
});

describe("isLegacyBolloCandidate", () => {
  it("fattura storica da correggere: sopra soglia, senza bollo, senza snapshotAnagrafica", () => {
    expect(
      isLegacyBolloCandidate({
        snapshotAnagrafica: null,
        prezzoTotale: 79.47,
        bolloCodice: null,
      })
    ).toBe(true);
  });

  it("sotto soglia: non candidata anche senza snapshotAnagrafica/bolloCodice", () => {
    expect(
      isLegacyBolloCandidate({
        snapshotAnagrafica: null,
        prezzoTotale: 50,
        bolloCodice: null,
      })
    ).toBe(false);
  });

  it("bolloCodice già presente: non candidata (già corretta, o bollo vero già registrato)", () => {
    expect(
      isLegacyBolloCandidate({
        snapshotAnagrafica: null,
        prezzoTotale: 79.47,
        bolloCodice: "12345678901234",
      })
    ).toBe(false);
  });

  it("fattura NUOVA con bollo dovuto ma non ancora inserito (bolloMancante): NON va toccata", () => {
    // Stato valido e previsto dall'app attuale: sopra soglia, bolloCodice
    // nullo, ma creata tramite createInvoice, quindi snapshotAnagrafica è
    // valorizzato. Senza il controllo su snapshotAnagrafica questa fattura
    // avrebbe la stessa forma di una riga storica, e verrebbe corrotta.
    expect(
      isLegacyBolloCandidate({
        snapshotAnagrafica: { pagante: {}, paziente: {} },
        prezzoTotale: 79.47,
        bolloCodice: null,
      })
    ).toBe(false);
  });

  it("esattamente alla soglia: non candidata (il vecchio sistema sommava il bollo solo SOPRA soglia)", () => {
    expect(
      isLegacyBolloCandidate({
        snapshotAnagrafica: null,
        prezzoTotale: 77.47,
        bolloCodice: null,
      })
    ).toBe(false);
  });
});
