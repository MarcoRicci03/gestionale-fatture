import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PayersManager } from "./payers-manager";
import type { Pagante, Paziente } from "@prisma/client";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/payers",
}));

vi.mock("@/lib/actions/payers", () => ({
  archivePayer: vi.fn(async () => ({ success: true })),
  restorePayer: vi.fn(async () => ({ success: true })),
  hardDeletePayer: vi.fn(async () => ({ success: true })),
}));

function makePayer(id: number, cognome = "Rossi", nome = "Mario") {
  return {
    id,
    cognome,
    nome,
    cf: `CF${id}`,
    piva: null,
    via: "Via Roma 1",
    citta: "Roma",
    cap: "00100",
    id_Utente: 1,
    archiviato: false,
    pazienti: [] as Paziente[],
  } as unknown as Pagante & { pazienti: Paziente[] };
}

const baseProps = {
  payers: [makePayer(1, "Rossi", "Mario"), makePayer(2, "Bianchi", "Luigi")],
  totalCount: 50,
  page: 1,
  archivedPayers: [],
  archivedTotalCount: 0,
  archivedPage: 1,
  search: "",
};

describe("PayersManager", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("i pulsanti azione riga usano l'attributo nativo title invece di Tooltip", () => {
    render(<PayersManager {...baseProps} />);

    const viewButtons = screen.getAllByRole("button", { name: "Visualizza dettagli pagante" });
    expect(viewButtons[0]).toHaveAttribute("title", "Visualizza dettagli pagante");

    const editButtons = screen.getAllByRole("button", { name: "Modifica pagante" });
    expect(editButtons[0]).toHaveAttribute("title", "Modifica pagante");

    const archiveButtons = screen.getAllByRole("button", { name: "Archivia pagante" });
    expect(archiveButtons[0]).toHaveAttribute("title", "Archivia pagante");
  });

  it("mostra il riepilogo selezione e persiste la selezione tra le pagine", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PayersManager {...baseProps} />);

    // Inizialmente nessun riepilogo selezione
    expect(screen.queryByText(/elementi selezionati in totale/)).not.toBeInTheDocument();

    // Seleziona il primo pagante a pagina 1
    const [checkbox1] = screen.getAllByRole("checkbox", {
      name: "Seleziona pagante Rossi Mario",
    });
    await user.click(checkbox1);
    expect(checkbox1).toBeChecked();

    // Mostra il badge/testo di riepilogo
    expect(screen.getByText("1 elemento selezionato in totale")).toBeInTheDocument();

    // Simula passaggio a pagina 2 (props aggiornate dal server)
    rerender(
      <PayersManager
        {...baseProps}
        page={2}
        payers={[makePayer(3, "Verdi", "Giuseppe"), makePayer(4, "Neri", "Marco")]}
      />
    );

    // La selezione a pagina 1 DEVE persistere
    expect(screen.getByText("1 elemento selezionato in totale")).toBeInTheDocument();

    // Seleziona un pagante a pagina 2
    const [checkbox3] = screen.getAllByRole("checkbox", {
      name: "Seleziona pagante Verdi Giuseppe",
    });
    await user.click(checkbox3);
    expect(screen.getByText("2 elementi selezionati in totale")).toBeInTheDocument();

    // Torna a pagina 1
    rerender(<PayersManager {...baseProps} page={1} />);

    // Il pagante 1 a pagina 1 deve risultare ancora selezionato
    const [checkbox1Again] = screen.getAllByRole("checkbox", {
      name: "Seleziona pagante Rossi Mario",
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
    render(<PayersManager {...baseProps} />);

    const selectAll = screen.getByRole("checkbox", {
      name: "Seleziona tutti i paganti visibili",
    });
    expect(selectAll).not.toBeChecked();

    await user.click(selectAll);
    expect(screen.getByText("2 elementi selezionati in totale")).toBeInTheDocument();

    await user.click(selectAll);
    expect(screen.queryByText(/elementi selezionati in totale/)).not.toBeInTheDocument();
  });

  it("cambiare la dimensione pagina naviga con pageSize e resetta a pagina 1", async () => {
    const user = userEvent.setup();
    render(<PayersManager {...baseProps} page={2} totalCount={50} pageSize={25} />);

    const select = screen.getByLabelText("Elementi per pagina");
    expect(select).toHaveValue("25");

    await user.selectOptions(select, "10");

    expect(replace).toHaveBeenCalledTimes(1);
    const calledUrl = (replace.mock.calls[0] as [string, unknown])[0];
    expect(calledUrl).toContain("pageSize=10");
    expect(calledUrl).not.toContain("page=2");
  });
});

