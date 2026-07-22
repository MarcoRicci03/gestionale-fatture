import { describe, it, expect } from "vitest";
import {
  buildSnapshotAnagrafica,
  isSnapshotAnagrafica,
  resolveAnagrafica,
  type SnapshotAnagrafica,
} from "./anagrafica-snapshot";
import type { Pagante, Paziente } from "@prisma/client";

// Regressione: una fattura emessa deve continuare a mostrare i dati di
// pagante/paziente COM'ERANO al momento dell'emissione, non quelli attuali
// (vedi docs/superpowers/specs/2026-07-22-invoice-snapshot-anagrafica-design.md).

const PAGANTE: Pagante = {
  id: 1,
  id_Utente: 1,
  nome: "Mario",
  cognome: "Rossi",
  via: "Via Roma 1",
  citta: "Roma",
  cap: "00100",
  cf: "RSSMRA80A01H501Z",
  piva: null,
  archiviato: false,
};

const PAZIENTE: Paziente = {
  id: 1,
  id_Utente: 1,
  id_Pagante: 1,
  nome: "Giulia",
  cognome: "Rossi",
  archiviato: false,
};

const SNAPSHOT_VALIDO: SnapshotAnagrafica = {
  pagante: {
    nome: "Mario",
    cognome: "Rossi",
    via: "Via Vecchia 9",
    citta: "Roma",
    cap: "00100",
    cf: "RSSMRA80A01H501Z",
    piva: null,
  },
  paziente: { nome: "Giulia", cognome: "Rossi" },
};

describe("buildSnapshotAnagrafica", () => {
  it("estrae solo i campi rilevanti da pagante e paziente", () => {
    const snapshot = buildSnapshotAnagrafica(PAGANTE, PAZIENTE);
    expect(snapshot).toEqual({
      pagante: {
        nome: "Mario",
        cognome: "Rossi",
        via: "Via Roma 1",
        citta: "Roma",
        cap: "00100",
        cf: "RSSMRA80A01H501Z",
        piva: null,
      },
      paziente: { nome: "Giulia", cognome: "Rossi" },
    });
  });
});

describe("isSnapshotAnagrafica", () => {
  it("accetta uno snapshot valido", () => {
    expect(isSnapshotAnagrafica(SNAPSHOT_VALIDO)).toBe(true);
  });

  it("rifiuta null", () => {
    expect(isSnapshotAnagrafica(null)).toBe(false);
  });

  it("rifiuta un oggetto senza il blocco pagante", () => {
    expect(isSnapshotAnagrafica({ paziente: { nome: "a", cognome: "b" } })).toBe(false);
  });

  it("rifiuta un oggetto con un campo pagante mancante", () => {
    const { via: _via, ...paganteSenzaVia } = SNAPSHOT_VALIDO.pagante;
    expect(
      isSnapshotAnagrafica({ pagante: paganteSenzaVia, paziente: SNAPSHOT_VALIDO.paziente })
    ).toBe(false);
  });

  it("rifiuta un array", () => {
    expect(isSnapshotAnagrafica([])).toBe(false);
  });
});

describe("resolveAnagrafica", () => {
  it("usa lo snapshot quando presente e valido", () => {
    const result = resolveAnagrafica({
      snapshotAnagrafica: SNAPSHOT_VALIDO,
      pagante: PAGANTE,
      paziente: PAZIENTE,
    });
    expect(result).toEqual(SNAPSHOT_VALIDO);
  });

  it("ricade sulle relazioni live quando lo snapshot è null (fatture precedenti al fix)", () => {
    const result = resolveAnagrafica({
      snapshotAnagrafica: null,
      pagante: PAGANTE,
      paziente: PAZIENTE,
    });
    expect(result).toEqual(buildSnapshotAnagrafica(PAGANTE, PAZIENTE));
  });

  it("ricade sulle relazioni live quando lo snapshot ha una forma non valida", () => {
    const result = resolveAnagrafica({
      snapshotAnagrafica: { pagante: { nome: "solo questo" } },
      pagante: PAGANTE,
      paziente: PAZIENTE,
    });
    expect(result).toEqual(buildSnapshotAnagrafica(PAGANTE, PAZIENTE));
  });
});
