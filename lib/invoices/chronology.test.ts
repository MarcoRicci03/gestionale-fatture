import { describe, it, expect } from "vitest";
import {
  findChronologyConflict,
  formatChronologyConflictMessage,
  type ChronologyNeighbor,
} from "./chronology";

// Bloccare n_fattura/anno dopo l'emissione non basta, perché lasciare
// libero il giorno/mese della data
// permetterebbe comunque un'inversione cronologica (es. la fattura #6
// spostata a una data precedente alla #5). Questo modulo verifica solo la
// regola pura (nessun accesso a Prisma): la data deve restare compresa tra
// il vicino con numero minore e quello con numero maggiore, estremi
// inclusi.

const PRECEDENTE: ChronologyNeighbor = {
  n_fattura: 5,
  data: new Date(2026, 4, 10, 12, 0, 0), // 10 maggio 2026
};

const SUCCESSIVO: ChronologyNeighbor = {
  n_fattura: 7,
  data: new Date(2026, 4, 25, 12, 0, 0), // 25 maggio 2026
};

describe("findChronologyConflict", () => {
  it("nessun vicino: qualunque data è valida", () => {
    const data = new Date(2026, 0, 1, 12, 0, 0);
    expect(findChronologyConflict(data, null, null)).toBeNull();
  });

  it("solo vicino precedente, data successiva: valida", () => {
    const data = new Date(2026, 4, 20, 12, 0, 0);
    expect(findChronologyConflict(data, PRECEDENTE, null)).toBeNull();
  });

  it("solo vicino precedente, data antecedente: conflitto", () => {
    const data = new Date(2026, 4, 5, 12, 0, 0);
    const conflict = findChronologyConflict(data, PRECEDENTE, null);
    expect(conflict?.side).toBe("precedente");
    expect(conflict?.neighbor.n_fattura).toBe(5);
  });

  it("stessa data del vicino precedente: valida (estremo incluso)", () => {
    expect(findChronologyConflict(PRECEDENTE.data, PRECEDENTE, null)).toBeNull();
  });

  it("solo vicino successivo, data precedente: valida", () => {
    const data = new Date(2026, 4, 20, 12, 0, 0);
    expect(findChronologyConflict(data, null, SUCCESSIVO)).toBeNull();
  });

  it("solo vicino successivo, data successiva: conflitto", () => {
    const data = new Date(2026, 4, 30, 12, 0, 0);
    const conflict = findChronologyConflict(data, null, SUCCESSIVO);
    expect(conflict?.side).toBe("successivo");
    expect(conflict?.neighbor.n_fattura).toBe(7);
  });

  it("stessa data del vicino successivo: valida (estremo incluso)", () => {
    expect(findChronologyConflict(SUCCESSIVO.data, null, SUCCESSIVO)).toBeNull();
  });

  it("entrambi i vicini, data nell'intervallo: valida", () => {
    const data = new Date(2026, 4, 20, 12, 0, 0);
    expect(findChronologyConflict(data, PRECEDENTE, SUCCESSIVO)).toBeNull();
  });

  it("entrambi i vicini, data prima del precedente: conflitto sul lato precedente (caso della fattura #6 spostata prima della #5)", () => {
    const data = new Date(2026, 4, 5, 12, 0, 0);
    const conflict = findChronologyConflict(data, PRECEDENTE, SUCCESSIVO);
    expect(conflict?.side).toBe("precedente");
  });

  it("entrambi i vicini, data dopo il successivo: conflitto sul lato successivo", () => {
    const data = new Date(2026, 4, 30, 12, 0, 0);
    const conflict = findChronologyConflict(data, PRECEDENTE, SUCCESSIVO);
    expect(conflict?.side).toBe("successivo");
  });

  it("un vicino passato dal chiamante vincola sempre, senza distinzioni di stato", () => {
    // Stesso identico input di PRECEDENTE: la funzione riceve solo
    // numero/data, nessun flag di stato, quindi qualunque vicino passato dal
    // chiamante vincola allo stesso modo — nessuna logica speciale da
    // testare qui oltre a confermare che il vicino non viene ignorato.
    const data = new Date(2026, 4, 5, 12, 0, 0);
    const conflict = findChronologyConflict(data, PRECEDENTE, null);
    expect(conflict).not.toBeNull();
  });
});

describe("formatChronologyConflictMessage", () => {
  it("messaggio per conflitto sul lato precedente", () => {
    const message = formatChronologyConflictMessage({
      side: "precedente",
      neighbor: PRECEDENTE,
    });
    expect(message).toContain("10/05/2026");
    expect(message).toContain("#5");
    expect(message).toContain("precedente");
  });

  it("messaggio per conflitto sul lato successivo", () => {
    const message = formatChronologyConflictMessage({
      side: "successivo",
      neighbor: SUCCESSIVO,
    });
    expect(message).toContain("25/05/2026");
    expect(message).toContain("#7");
    expect(message).toContain("successiva");
  });
});
