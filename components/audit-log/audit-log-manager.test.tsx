// components/audit-log/audit-log-manager.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditLogManager } from "./audit-log-manager";
import type { AuditLogEntry } from "@/lib/data/audit-log-select";

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 1,
    azione: "auth.login_success",
    entita: null,
    entitaId: null,
    meta: null,
    ip: "10.0.0.1",
    createdAt: new Date(2026, 5, 15, 10, 0, 0),
    utente: { id: 1, username: "mario" },
    ...overrides,
  };
}

describe("AuditLogManager", () => {
  it("mostra tutti gli eventi passati come prop e il conteggio nel sottotitolo", () => {
    const entries = [
      makeEntry({ id: 1, utente: { id: 1, username: "mario" } }),
      makeEntry({ id: 2, azione: "invoice.create", utente: { id: 2, username: "luigi" } }),
    ];
    render(<AuditLogManager entries={entries} />);
    expect(screen.getByText("2 di 2 eventi: accessi e operazioni sensibili")).toBeInTheDocument();
  });

  it("filtra la lista per utente selezionato", async () => {
    const user = userEvent.setup();
    const entries = [
      makeEntry({ id: 1, azione: "auth.login_success", utente: { id: 1, username: "mario" } }),
      makeEntry({ id: 2, azione: "invoice.create", utente: { id: 2, username: "luigi" } }),
    ];
    render(<AuditLogManager entries={entries} />);

    await user.click(screen.getByLabelText("Utente"));
    await user.click(await screen.findByRole("option", { name: "luigi" }));

    expect(screen.getByText("1 di 2 eventi: accessi e operazioni sensibili")).toBeInTheDocument();
  });
});
