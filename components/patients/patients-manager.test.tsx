import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PatientsManager } from "./patients-manager";
import type { Paziente, Pagante } from "@prisma/client";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/patients",
}));

vi.mock("@/lib/actions/patients", () => ({
  archivePatient: vi.fn(async () => ({ success: true })),
  restorePatient: vi.fn(async () => ({ success: true })),
  hardDeletePatient: vi.fn(async () => ({ success: true })),
}));

function makePatient(id: number, cognome = "Rossi", nome = "Mario") {
  return {
    id,
    cognome,
    nome,
    cf: `CF${id}`,
    citta: "Roma",
    cap: "00100",
    indirizzo: "Via Roma 1",
    id_Utente: 1,
    id_Pagante: null,
    archiviato: false,
    archiviatoInCascata: false,
    pagante: null,
  } as unknown as Paziente & { pagante: Pagante | null };
}

const baseProps = {
  patients: [makePatient(1, "Rossi", "Mario"), makePatient(2, "Bianchi", "Luigi")],
  totalCount: 50,
  page: 1,
  payers: [],
  archivedPatients: [],
  archivedTotalCount: 0,
  archivedPage: 1,
  search: "",
};

describe("PatientsManager", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("i pulsanti azione riga usano l'attributo nativo title invece di Tooltip", () => {
    render(<PatientsManager {...baseProps} />);

    const viewButtons = screen.getAllByRole("button", { name: "Visualizza dettagli paziente" });
    expect(viewButtons[0]).toHaveAttribute("title", "Visualizza dettagli paziente");

    const editButtons = screen.getAllByRole("button", { name: "Modifica paziente" });
    expect(editButtons[0]).toHaveAttribute("title", "Modifica paziente");

    const archiveButtons = screen.getAllByRole("button", { name: "Archivia paziente" });
    expect(archiveButtons[0]).toHaveAttribute("title", "Archivia paziente");
  });

  it("mostra il riepilogo selezione e persiste la selezione tra le pagine", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PatientsManager {...baseProps} />);

    // Inizialmente nessun riepilogo selezione
    expect(screen.queryByText(/elementi selezionati in totale/)).not.toBeInTheDocument();

    // Seleziona il primo paziente a pagina 1
    const [checkbox1] = screen.getAllByRole("checkbox", {
      name: "Seleziona paziente Rossi Mario",
    });
    await user.click(checkbox1);
    expect(checkbox1).toBeChecked();

    // Mostra il badge/testo di riepilogo
    expect(screen.getByText("1 elemento selezionato in totale")).toBeInTheDocument();

    // Simula passaggio a pagina 2 (props aggiornate dal server)
    rerender(
      <PatientsManager
        {...baseProps}
        page={2}
        patients={[makePatient(3, "Verdi", "Giuseppe"), makePatient(4, "Neri", "Marco")]}
      />
    );

    // La selezione a pagina 1 DEVE persistere
    expect(screen.getByText("1 elemento selezionato in totale")).toBeInTheDocument();

    // Seleziona un paziente a pagina 2
    const [checkbox3] = screen.getAllByRole("checkbox", {
      name: "Seleziona paziente Verdi Giuseppe",
    });
    await user.click(checkbox3);
    expect(screen.getByText("2 elementi selezionati in totale")).toBeInTheDocument();

    // Torna a pagina 1
    rerender(<PatientsManager {...baseProps} page={1} />);

    // Il paziente 1 a pagina 1 deve risultare ancora selezionato
    const [checkbox1Again] = screen.getAllByRole("checkbox", {
      name: "Seleziona paziente Rossi Mario",
    });
    expect(checkbox1Again).toBeChecked();
    expect(screen.getByText("2 elementi selezionati in totale")).toBeInTheDocument();

    // Clicca su "Deseleziona tutti"
    await user.click(screen.getByRole("button", { name: "Deseleziona tutti" }));
    expect(screen.queryByText(/elementi selezionati in totale/)).not.toBeInTheDocument();
    expect(checkbox1Again).not.toBeChecked();
  });

  it("il checkbox seleziona tutti visibili seleziona e deseleziona le righe correnti", async () => {
    const user = userEvent.setup();
    render(<PatientsManager {...baseProps} />);

    const selectAll = screen.getByRole("checkbox", {
      name: "Seleziona tutti i pazienti visibili",
    });
    expect(selectAll).not.toBeChecked();

    await user.click(selectAll);
    expect(screen.getByText("2 elementi selezionati in totale")).toBeInTheDocument();

    await user.click(selectAll);
    expect(screen.queryByText(/elementi selezionati in totale/)).not.toBeInTheDocument();
  });

  it("cambiare la dimensione pagina naviga con pageSize e resetta a pagina 1", async () => {
    const user = userEvent.setup();
    render(<PatientsManager {...baseProps} page={2} totalCount={50} pageSize={25} />);

    const select = screen.getByLabelText("Elementi per pagina");
    expect(select).toHaveValue("25");

    await user.selectOptions(select, "10");

    expect(replace).toHaveBeenCalledTimes(1);
    const calledUrl = (replace.mock.calls[0] as [string, unknown])[0];
    expect(calledUrl).toContain("pageSize=10");
    expect(calledUrl).not.toContain("page=2");
  });
});

