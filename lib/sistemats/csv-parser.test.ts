import { describe, it, expect } from "vitest";
import { getErrorsForInvoice, parseCsvErroriTs } from "./csv-parser";

describe("parseCsvErroriTs", () => {
  it("restituisce una mappa vuota se il csv è vuoto o nullo", () => {
    expect(parseCsvErroriTs(null).size).toBe(0);
    expect(parseCsvErroriTs("").size).toBe(0);
    expect(parseCsvErroriTs("   ").size).toBe(0);
  });

  it("analizza correttamente il CSV ministeriale Sogei a 11 colonne", () => {
    const csv = `CF PROPRIETARIO; COD REGIONE; COD ASL; COD SSA; PARTITA IVA; DATA EMISSIONE; DOCUMENTO FISCALE DISPOSITIVO; DOCUMENTO FISCALE NUMERO; TIPO SPESA; CODICE ERRORE; DESCRIZIONE ERRORE
MTOMRA66A41G224M;;;;65498732105;10/02/2026;1;1;;W003;IL CF CITTADINO NON PRESENTE IN ARCHIVIO
MTOMRA66A41G224M;;;;65498732105;10/02/2026;1;1;;S017;IDENTIFICATIVO DOCUMENTO FISCALE GIA' PRESENTE
MTOMRA66A41G224M;;;;65498732105;15/02/2026;1;2;;W003;IL CF CITTADINO NON PRESENTE IN ARCHIVIO
`;

    const map = parseCsvErroriTs(csv);
    expect(map.size).toBe(2);

    const doc1 = map.get("1");
    expect(doc1).toBeDefined();
    expect(doc1?.length).toBe(2);
    expect(doc1?.[0]).toMatchObject({
      codiceErrore: "W003",
      tipo: "WARNING",
      descrizione: "IL CF CITTADINO NON PRESENTE IN ARCHIVIO",
      anno: 2026,
      dataEmissione: "10/02/2026",
      numDocumento: "1",
    });
    expect(doc1?.[1]).toMatchObject({
      codiceErrore: "S017",
      tipo: "ERRORE",
      descrizione: "IDENTIFICATIVO DOCUMENTO FISCALE GIA' PRESENTE",
      anno: 2026,
      dataEmissione: "10/02/2026",
      numDocumento: "1",
    });

    const doc2 = map.get("2");
    expect(doc2).toBeDefined();
    expect(doc2?.length).toBe(1);
    expect(doc2?.[0]).toMatchObject({
      codiceErrore: "W003",
      tipo: "WARNING",
      descrizione: "IL CF CITTADINO NON PRESENTE IN ARCHIVIO",
      anno: 2026,
      dataEmissione: "15/02/2026",
      numDocumento: "2",
    });
  });

  it("analizza CSV semplificato a 3 colonne", () => {
    const csv = `numDocumento;codice;descrizione\n5;E100;Errore gravissimo\n`;
    const map = parseCsvErroriTs(csv);
    expect(map.size).toBe(1);
    expect(map.get("5")).toEqual([
      expect.objectContaining({
        codiceErrore: "E100",
        tipo: "ERRORE",
        descrizione: "Errore gravissimo",
        numDocumento: "5",
      }),
    ]);
  });

  it("analizza CSV semplificato a 3 colonne SENZA intestazione (la prima riga è già dato)", () => {
    const csv = `1;S017;Identificativo gia presente;ERRORE\n2;W003;CF non presente;WARNING\n`;
    const map = parseCsvErroriTs(csv);
    expect(map.size).toBe(2);
    expect(map.get("1")).toEqual([
      expect.objectContaining({
        codiceErrore: "S017",
        tipo: "ERRORE",
        descrizione: "Identificativo gia presente",
        numDocumento: "1",
      }),
    ]);
    expect(map.get("2")).toEqual([
      expect.objectContaining({
        codiceErrore: "W003",
        tipo: "WARNING",
        descrizione: "CF non presente",
        numDocumento: "2",
      }),
    ]);
  });

  it("analizza CSV ministeriale a 11 colonne SENZA intestazione", () => {
    const csv = `MTOMRA66A41G224M;;;;65498732105;10/02/2026;1;10;;S017;GIA PRESENTE\nMTOMRA66A41G224M;;;;65498732105;15/02/2026;1;20;;W003;AVVISO\n`;
    const map = parseCsvErroriTs(csv);
    expect(map.size).toBe(2);
    expect(map.get("10")?.[0].codiceErrore).toBe("S017");
    expect(map.get("20")?.[0].codiceErrore).toBe("W003");
  });

  it("gestisce un CSV con un singolo record dati senza intestazione", () => {
    const csv = `42;E100;Errore singolo`;
    const map = parseCsvErroriTs(csv);
    expect(map.size).toBe(1);
    expect(map.get("42")?.[0].codiceErrore).toBe("E100");
  });

  it("restituisce mappa vuota se il CSV contiene solo la riga di intestazione", () => {
    const csv = `numDocumento;codice;descrizione`;
    const map = parseCsvErroriTs(csv);
    expect(map.size).toBe(0);
  });

  describe("Disambiguazione multi-anno con getErrorsForInvoice", () => {
    const multiYearCsv = `CF PROPRIETARIO; COD REGIONE; COD ASL; COD SSA; PARTITA IVA; DATA EMISSIONE; DOCUMENTO FISCALE DISPOSITIVO; DOCUMENTO FISCALE NUMERO; TIPO SPESA; CODICE ERRORE; DESCRIZIONE ERRORE
MTOMRA66A41G224M;;;;65498732105;30/12/2025;1;1;;S050;CF CITTADINO FORMALMENTE ERRATO
MTOMRA66A41G224M;;;;65498732105;15/01/2026;1;2;;W003;AVVISO NON BLOCCANTE
`;

    it("estrae correttamente anno e dataEmissione dal CSV ministeriale a 11 colonne", () => {
      const map = parseCsvErroriTs(multiYearCsv);
      const doc1 = map.get("1");
      expect(doc1).toBeDefined();
      expect(doc1?.[0].anno).toBe(2025);
      expect(doc1?.[0].dataEmissione).toBe("30/12/2025");
      expect(doc1?.[0].numDocumento).toBe("1");
    });

    it("isola gli errori per la fattura n. 1 del 2025 senza contaminare la fattura n. 1 del 2026", () => {
      const map = parseCsvErroriTs(multiYearCsv);

      // Fattura 1/2025 ha l'errore S050
      const errors2025 = getErrorsForInvoice(map, { n_fattura: 1, anno: 2025 });
      expect(errors2025).toHaveLength(1);
      expect(errors2025[0].codiceErrore).toBe("S050");

      // Fattura 1/2026 NON ha errori nel CSV (non deve ricevere l'errore della 1/2025!)
      const errors2026 = getErrorsForInvoice(map, { n_fattura: 1, anno: 2026 });
      expect(errors2026).toHaveLength(0);
    });

    it("gestisce date di emissione in formato ISO YYYY-MM-DD", () => {
      const isoCsv = `CF PROPRIETARIO; COD REGIONE; COD ASL; COD SSA; PARTITA IVA; DATA EMISSIONE; DOCUMENTO FISCALE DISPOSITIVO; DOCUMENTO FISCALE NUMERO; TIPO SPESA; CODICE ERRORE; DESCRIZIONE ERRORE
MTOMRA66A41G224M;;;;65498732105;2026-03-01;1;5;;S017;GIA PRESENTE
`;
      const map = parseCsvErroriTs(isoCsv);
      const errors = getErrorsForInvoice(map, { n_fattura: 5, anno: 2026 });
      expect(errors).toHaveLength(1);
      expect(errors[0].anno).toBe(2026);
      expect(errors[0].codiceErrore).toBe("S017");

      // Anno non corrispondente
      const errorsOtherYear = getErrorsForInvoice(map, { n_fattura: 5, anno: 2025 });
      expect(errorsOtherYear).toHaveLength(0);
    });

    it("supporta il fallback trasparente per CSV a 3 colonne privi di data", () => {
      const legacyCsv = `1;S017;Gia presente\n`;
      const map = parseCsvErroriTs(legacyCsv);

      // Anche chiedendo con anno 2026, riceve gli errori perché il CSV non ha colonna data (fallback)
      const errors = getErrorsForInvoice(map, { n_fattura: 1, anno: 2026 });
      expect(errors).toHaveLength(1);
      expect(errors[0].codiceErrore).toBe("S017");
    });
  });
});

