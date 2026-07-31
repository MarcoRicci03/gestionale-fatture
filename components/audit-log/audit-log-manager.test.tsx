// components/audit-log/audit-log-manager.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditLogManager } from "./audit-log-manager";
import { EMPTY_AUDIT_LOG_FILTERS } from "@/lib/audit/list-query";
import type { AuditLogEntry } from "@/lib/data/audit-log-select";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/audit-log",
}));

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

const baseProps = {
  entries: [] as AuditLogEntry[],
  totalCount: 0,
  page: 1,
  filters: EMPTY_AUDIT_LOG_FILTERS,
  usernames: ["luigi", "mario"],
};

// LOG-03: entries/totalCount/page arrivano già filtrati e paginati dal
// server (getAuditLog), quindi qui si testa che AuditLogManager navighi
// correttamente al cambio filtro/pagina — non più che filtri un array
// client-side (quel comportamento non esiste più, era proprio il bug).
describe("AuditLogManager", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("mostra il conteggio totale nel sottotitolo", () => {
    render(<AuditLogManager {...baseProps} totalCount={2} />);
    expect(screen.getByText("2 eventi: accessi e operazioni sensibili")).toBeInTheDocument();
  });

  it("nessun evento nella pagina corrente: mostra il messaggio, non una tabella vuota", () => {
    render(<AuditLogManager {...baseProps} />);
    expect(
      screen.getByText("Nessun evento corrisponde ai filtri selezionati.")
    ).toBeInTheDocument();
  });

  it("cambiare l'utente naviga con quel filtro e resetta a page 1", async () => {
    const user = userEvent.setup();
    render(<AuditLogManager {...baseProps} page={2} />);

    await user.click(screen.getByLabelText("Utente"));
    await user.click(await screen.findByRole("option", { name: "luigi" }));

    expect(replace).toHaveBeenCalledWith("/audit-log?utente=luigi", { scroll: false });
  });

  it("'Reset filtri' naviga all'URL nudo, senza parametri residui", async () => {
    const user = userEvent.setup();
    render(
      <AuditLogManager
        {...baseProps}
        filters={{ ...EMPTY_AUDIT_LOG_FILTERS, utente: "mario" }}
      />
    );
    await user.click(screen.getByRole("button", { name: "Reset filtri" }));
    expect(replace).toHaveBeenCalledWith("/audit-log", { scroll: false });
  });

  it("due cambi filtro ravvicinati senza re-render nel mezzo: il secondo replace() include ENTRAMBI i patch", async () => {
    const user = userEvent.setup();
    // `filters` resta la prop iniziale per tutto il test (nessun rerender):
    // simula il round-trip RSC non ancora arrivato, stesso scenario già
    // coperto per InvoicesManager.
    render(<AuditLogManager {...baseProps} />);

    await user.click(screen.getByLabelText("Azione"));
    await user.click(await screen.findByRole("option", { name: "Creazione fattura" }));

    fireEvent.change(screen.getByLabelText("Data da"), {
      target: { value: "2026-06-01" },
    });

    expect(replace).toHaveBeenCalledTimes(2);
    const secondUrl = (replace.mock.calls[1] as [string, unknown])[0];
    expect(secondUrl).toContain("azione=invoice.create");
    expect(secondUrl).toContain("dataDa=2026-06-01");
  });

  it("cambiare pagina naviga mantenendo i filtri correnti", async () => {
    const user = userEvent.setup();
    render(
      <AuditLogManager
        {...baseProps}
        entries={[makeEntry()]}
        totalCount={30}
        page={1}
        filters={{ ...EMPTY_AUDIT_LOG_FILTERS, utente: "mario" }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Pagina successiva" }));

    expect(replace).toHaveBeenCalledWith("/audit-log?utente=mario&page=2", { scroll: false });
  });
});
