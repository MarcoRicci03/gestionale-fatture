import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PayerForm } from "./payer-form";
import type { Pagante } from "@prisma/client";

const mockCreatePayer = vi.fn();
const mockUpdatePayer = vi.fn();
const mockRefresh = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
}));

vi.mock("@/lib/actions/payers", () => ({
  createPayer: (...args: unknown[]) => mockCreatePayer(...args),
  updatePayer: (...args: unknown[]) => mockUpdatePayer(...args),
}));

describe("PayerForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPayer: Pagante = {
    id: 5,
    id_Utente: 1,
    nome: "Mario",
    cognome: "Rossi",
    via: "Via Roma 1",
    citta: "Milano",
    cap: "20100",
    cf: "RSSMRA80A01H501U",
    piva: null,
    archiviato: false,
  };

  it("non mostra la spunta di propagazione in creazione di un nuovo pagante", () => {
    render(<PayerForm />);
    expect(
      screen.queryByText(/Aggiorna i dati anche sulle fatture non ancora inviate/i)
    ).not.toBeInTheDocument();
  });

  it("mostra la spunta di propagazione in modifica pagante e la lascia deselezionata di default", () => {
    render(<PayerForm payer={mockPayer} />);
    const checkbox = screen.getByLabelText(
      /Aggiorna i dati anche sulle fatture non ancora inviate/i
    );
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("invia propagaFattureInAttesa: true a updatePayer se l'utente spunta l'opzione", async () => {
    const user = userEvent.setup();
    mockUpdatePayer.mockResolvedValueOnce({ success: true });

    render(<PayerForm payer={mockPayer} />);

    const checkbox = screen.getByLabelText(
      /Aggiorna i dati anche sulle fatture non ancora inviate/i
    );
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    const submitBtn = screen.getByRole("button", { name: "Aggiorna" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdatePayer).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          cf: "RSSMRA80A01H501U",
          propagaFattureInAttesa: true,
        })
      );
    });
  });
});
