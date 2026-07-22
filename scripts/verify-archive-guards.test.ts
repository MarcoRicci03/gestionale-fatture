import { describe, it, expect } from "vitest";
import {
  findRestoreConflict,
  canHardDeletePayer,
  canHardDeletePatient,
} from "../lib/archive/guards";

// Regressione sulle regole di lib/archive/guards.ts: il ripristino di un
// pagante non deve mai violare gli indici unique parziali su cf/piva (attivi
// solo tra i paganti non archiviati), e l'hard-delete non deve mai poter
// cancellare in cascata fatture o pazienti che l'utente non ha già
// archiviato esplicitamente.

describe("findRestoreConflict", () => {
  it("rileva un conflitto su cf", () => {
    const conflict = findRestoreConflict(
      { cf: "RSSMRA80A01H501U", piva: null },
      [{ id: 42, cf: "RSSMRA80A01H501U", piva: null }]
    );
    expect(conflict?.field).toBe("cf");
    expect(conflict?.conflictingId).toBe(42);
  });

  it("rileva un conflitto su piva", () => {
    const conflict = findRestoreConflict(
      { cf: null, piva: "IT01234567890" },
      [{ id: 7, cf: null, piva: "IT01234567890" }]
    );
    expect(conflict?.field).toBe("piva");
    expect(conflict?.conflictingId).toBe(7);
  });

  it("non genera conflitto quando cf/piva sono entrambi null", () => {
    const conflict = findRestoreConflict({ cf: null, piva: null }, [
      { id: 1, cf: null, piva: null },
    ]);
    expect(conflict).toBeNull();
  });

  it("un pagante archiviato con lo stesso cf non produce conflitto", () => {
    // La lista passata a findRestoreConflict deve contenere SOLO paganti
    // attivi: se per errore vi finisse un archiviato con lo stesso cf, non
    // deve comunque contare come conflitto (l'indice è parziale su
    // archiviato = false).
    const activePayersOnly: { id: number; cf: string | null; piva: string | null }[] = [];
    const conflict = findRestoreConflict(
      { cf: "RSSMRA80A01H501U", piva: null },
      activePayersOnly
    );
    expect(conflict).toBeNull();
  });
});

describe("canHardDeletePayer", () => {
  it("consente l'hard-delete senza fatture né pazienti non archiviati", () => {
    expect(canHardDeletePayer({ fatture: 0, pazientiNonArchiviati: 0 })).toBe(true);
  });

  it("blocca l'hard-delete con fatture collegate", () => {
    expect(canHardDeletePayer({ fatture: 1, pazientiNonArchiviati: 0 })).toBe(false);
  });

  it("blocca l'hard-delete con pazienti non archiviati", () => {
    expect(canHardDeletePayer({ fatture: 0, pazientiNonArchiviati: 1 })).toBe(false);
  });

  it("blocca l'hard-delete con entrambi i blocker", () => {
    expect(canHardDeletePayer({ fatture: 1, pazientiNonArchiviati: 1 })).toBe(false);
  });
});

describe("canHardDeletePatient", () => {
  it("consente l'hard-delete di un paziente senza fatture", () => {
    expect(canHardDeletePatient({ fatture: 0 })).toBe(true);
  });

  it("blocca l'hard-delete di un paziente con fatture collegate", () => {
    expect(canHardDeletePatient({ fatture: 1 })).toBe(false);
  });
});
