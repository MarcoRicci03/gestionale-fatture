import { describe, it, expect } from "vitest";
import { withCurrentPayer, withCurrentPatient } from "./contact-options";
import type { Pagante, Paziente } from "@prisma/client";

function makePayer(overrides: Partial<Pagante> = {}): Pagante {
  return {
    id: 1,
    id_Utente: 1,
    nome: "Mario",
    cognome: "Rossi",
    via: "Via Roma 1",
    citta: "Roma",
    cap: "00100",
    cf: null,
    piva: null,
    archiviato: false,
    ...overrides,
  };
}

function makePatient(overrides: Partial<Paziente> = {}): Paziente {
  return {
    id: 10,
    id_Utente: 1,
    id_Pagante: 1,
    nome: "Giulia",
    cognome: "Rossi",
    archiviato: false,
    archiviatoInCascata: false,
    ...overrides,
  };
}

describe("withCurrentPayer", () => {
  it("non modifica l'elenco se current è null/undefined", () => {
    const payers = [makePayer()];
    expect(withCurrentPayer(payers, null)).toBe(payers);
    expect(withCurrentPayer(payers, undefined)).toBe(payers);
  });

  it("non modifica l'elenco se il pagante è già presente", () => {
    const payer = makePayer();
    const payers = [payer];
    expect(withCurrentPayer(payers, payer)).toBe(payers);
  });

  it("aggiunge il pagante archiviato se assente dall'elenco", () => {
    const archived = makePayer({ id: 99, archiviato: true });
    const result = withCurrentPayer([], archived);
    expect(result).toEqual([archived]);
  });

  it("non duplica un pagante con lo stesso id anche se l'oggetto è diverso", () => {
    const active = makePayer({ id: 5 });
    const staleCopy = makePayer({ id: 5, citta: "Milano" });
    const result = withCurrentPayer([active], staleCopy);
    expect(result).toEqual([active]);
  });
});

describe("withCurrentPatient", () => {
  it("non modifica l'elenco se current è null/undefined", () => {
    const patients = [{ ...makePatient(), pagante: null }];
    expect(withCurrentPatient(patients, null, null)).toBe(patients);
    expect(withCurrentPatient(patients, undefined, undefined)).toBe(patients);
  });

  it("non modifica l'elenco se il paziente è già presente", () => {
    const patient = { ...makePatient(), pagante: null };
    const patients = [patient];
    expect(withCurrentPatient(patients, patient, null)).toBe(patients);
  });

  it("aggiunge il paziente archiviato con il pagante annidato corretto", () => {
    const payer = makePayer({ id: 1 });
    const archivedPatient = makePatient({ id: 42, archiviato: true, id_Pagante: 1 });
    const result = withCurrentPatient([], archivedPatient, payer);
    expect(result).toEqual([{ ...archivedPatient, pagante: payer }]);
  });

  it("attribuisce pagante: null se currentPayer non è fornito", () => {
    const archivedPatient = makePatient({ id: 42, archiviato: true, id_Pagante: null });
    const result = withCurrentPatient([], archivedPatient, null);
    expect(result).toEqual([{ ...archivedPatient, pagante: null }]);
  });
});
