import { describe, it, expect } from "vitest";
import { parseCsvErroriTs } from "./csv-parser";

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
    expect(doc1?.[0]).toEqual({
      codiceErrore: "W003",
      tipo: "WARNING",
      descrizione: "IL CF CITTADINO NON PRESENTE IN ARCHIVIO",
    });
    expect(doc1?.[1]).toEqual({
      codiceErrore: "S017",
      tipo: "ERRORE",
      descrizione: "IDENTIFICATIVO DOCUMENTO FISCALE GIA' PRESENTE",
    });

    const doc2 = map.get("2");
    expect(doc2).toBeDefined();
    expect(doc2?.length).toBe(1);
    expect(doc2?.[0]).toEqual({
      codiceErrore: "W003",
      tipo: "WARNING",
      descrizione: "IL CF CITTADINO NON PRESENTE IN ARCHIVIO",
    });
  });

  it("analizza CSV semplificato a 3 colonne", () => {
    const csv = `numDocumento;codice;descrizione\n5;E100;Errore gravissimo\n`;
    const map = parseCsvErroriTs(csv);
    expect(map.size).toBe(1);
    expect(map.get("5")).toEqual([
      {
        codiceErrore: "E100",
        tipo: "ERRORE",
        descrizione: "Errore gravissimo",
      },
    ]);
  });

  it("analizza CSV semplificato a 3 colonne SENZA intestazione (la prima riga è già dato)", () => {
    const csv = `1;S017;Identificativo gia presente;ERRORE\n2;W003;CF non presente;WARNING\n`;
    const map = parseCsvErroriTs(csv);
    expect(map.size).toBe(2);
    expect(map.get("1")).toEqual([
      {
        codiceErrore: "S017",
        tipo: "ERRORE",
        descrizione: "Identificativo gia presente",
      },
    ]);
    expect(map.get("2")).toEqual([
      {
        codiceErrore: "W003",
        tipo: "WARNING",
        descrizione: "CF non presente",
      },
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
});

