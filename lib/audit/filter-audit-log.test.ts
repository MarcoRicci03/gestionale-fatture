import { describe, it, expect } from "vitest";
import {
  filterAuditLogEntries,
  getDistinctUsernames,
  EMPTY_AUDIT_LOG_FILTERS,
  type AuditLogFilters,
} from "./filter-audit-log";
import type { AuditLogEntry } from "@/lib/data/audit-log-select";

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 1,
    azione: "auth.login_success",
    entita: null,
    entitaId: null,
    meta: null,
    ip: null,
    createdAt: new Date(2026, 5, 15, 10, 0, 0),
    utente: { id: 1, username: "mario" },
    ...overrides,
  };
}

describe("filterAuditLogEntries", () => {
  it("senza filtri restituisce tutti gli eventi invariati", () => {
    const entries = [makeEntry({ id: 1 }), makeEntry({ id: 2 })];
    expect(filterAuditLogEntries(entries, EMPTY_AUDIT_LOG_FILTERS)).toEqual(entries);
  });

  it("filtra per intervallo di date includendo l'intera giornata di 'dataA'", () => {
    const entries = [
      makeEntry({ id: 1, createdAt: new Date(2026, 5, 14, 23, 59, 0) }),
      makeEntry({ id: 2, createdAt: new Date(2026, 5, 15, 8, 0, 0) }),
      makeEntry({ id: 3, createdAt: new Date(2026, 5, 15, 23, 30, 0) }),
      makeEntry({ id: 4, createdAt: new Date(2026, 5, 16, 0, 1, 0) }),
    ];
    const filters: AuditLogFilters = {
      ...EMPTY_AUDIT_LOG_FILTERS,
      dataDa: "2026-06-15",
      dataA: "2026-06-15",
    };
    expect(filterAuditLogEntries(entries, filters).map((e) => e.id)).toEqual([2, 3]);
  });

  it("filtra per username esatto", () => {
    const entries = [
      makeEntry({ id: 1, utente: { id: 1, username: "mario" } }),
      makeEntry({ id: 2, utente: { id: 2, username: "luigi" } }),
      makeEntry({ id: 3, utente: null }),
    ];
    const filters: AuditLogFilters = { ...EMPTY_AUDIT_LOG_FILTERS, utente: "luigi" };
    expect(filterAuditLogEntries(entries, filters).map((e) => e.id)).toEqual([2]);
  });

  it("filtra per azione esatta", () => {
    const entries = [
      makeEntry({ id: 1, azione: "auth.login_success" }),
      makeEntry({ id: 2, azione: "invoice.create" }),
    ];
    const filters: AuditLogFilters = { ...EMPTY_AUDIT_LOG_FILTERS, azione: "invoice.create" };
    expect(filterAuditLogEntries(entries, filters).map((e) => e.id)).toEqual([2]);
  });

  it("la ricerca libera fa match case-insensitive su entita, entitaId e ip", () => {
    const entries = [
      makeEntry({ id: 1, entita: "Pagamento", entitaId: 42, ip: "10.0.0.5" }),
      makeEntry({ id: 2, entita: "Paziente", entitaId: 7, ip: "192.168.1.1" }),
    ];
    expect(
      filterAuditLogEntries(entries, { ...EMPTY_AUDIT_LOG_FILTERS, ricerca: "pagamento" }).map(
        (e) => e.id
      )
    ).toEqual([1]);
    expect(
      filterAuditLogEntries(entries, { ...EMPTY_AUDIT_LOG_FILTERS, ricerca: "192.168" }).map(
        (e) => e.id
      )
    ).toEqual([2]);
    expect(
      filterAuditLogEntries(entries, { ...EMPTY_AUDIT_LOG_FILTERS, ricerca: "42" }).map((e) => e.id)
    ).toEqual([1]);
  });

  it("combina più filtri in AND", () => {
    const entries = [
      makeEntry({ id: 1, azione: "invoice.create", utente: { id: 1, username: "mario" } }),
      makeEntry({ id: 2, azione: "invoice.create", utente: { id: 2, username: "luigi" } }),
      makeEntry({ id: 3, azione: "invoice.delete", utente: { id: 1, username: "mario" } }),
    ];
    const filters: AuditLogFilters = {
      ...EMPTY_AUDIT_LOG_FILTERS,
      azione: "invoice.create",
      utente: "mario",
    };
    expect(filterAuditLogEntries(entries, filters).map((e) => e.id)).toEqual([1]);
  });
});

describe("getDistinctUsernames", () => {
  it("restituisce gli username distinti ordinati alfabeticamente, ignorando eventi senza utente", () => {
    const entries = [
      makeEntry({ id: 1, utente: { id: 1, username: "mario" } }),
      makeEntry({ id: 2, utente: { id: 2, username: "anna" } }),
      makeEntry({ id: 3, utente: { id: 1, username: "mario" } }),
      makeEntry({ id: 4, utente: null }),
    ];
    expect(getDistinctUsernames(entries)).toEqual(["anna", "mario"]);
  });
});
