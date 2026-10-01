import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SistemaTsForm } from "./sistema-ts-form";

// Mock router
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

// Mock Server Action
const mockSaveSistemaTsSettings = vi.fn();
vi.mock("@/lib/actions/sistema-ts", () => ({
  saveSistemaTsSettings: (...args: unknown[]) => mockSaveSistemaTsSettings(...args),
}));

describe("SistemaTsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    settings: null,
    userCf: "RSSMRA80A01H501Z",
    userPiva: "12345678901",
  };

  it("renderizza correttamente tutti i campi del form", () => {
    render(<SistemaTsForm {...defaultProps} />);

    expect(screen.getByLabelText(/Username \/ Codice Fiscale/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password TS/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^PinCode TS/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Natura IVA Predefinita/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Codice Regione/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Codice ASL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Codice Struttura/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salva Impostazioni/i })).toBeInTheDocument();
  });

  it("mostra l'avviso se il profilo utente non ha CF o Partita IVA", () => {
    render(<SistemaTsForm settings={null} userCf={null} userPiva={null} />);

    expect(
      screen.getByText(/il tuo profilo non contiene il Codice Fiscale o la Partita IVA/i)
    ).toBeInTheDocument();
  });

  it("non mostra l'avviso se il profilo utente è completo", () => {
    render(<SistemaTsForm {...defaultProps} />);

    expect(
      screen.queryByText(/il tuo profilo non contiene il Codice Fiscale o la Partita IVA/i)
    ).not.toBeInTheDocument();
  });

  it("permette di alternare la visibilità di Password e PinCode con i pulsanti toggle", async () => {
    const user = userEvent.setup();
    render(<SistemaTsForm {...defaultProps} />);

    const passwordInput = screen.getByLabelText(/^Password TS/i);
    const pincodeInput = screen.getByLabelText(/^PinCode TS/i);

    expect(passwordInput).toHaveAttribute("type", "password");
    expect(pincodeInput).toHaveAttribute("type", "password");

    // Toggle password
    const togglePasswordBtn = screen.getByRole("button", { name: /Mostra password/i });
    await user.click(togglePasswordBtn);
    expect(passwordInput).toHaveAttribute("type", "text");

    const hidePasswordBtn = screen.getByRole("button", { name: /Nascondi password/i });
    await user.click(hidePasswordBtn);
    expect(passwordInput).toHaveAttribute("type", "password");

    // Toggle pincode
    const togglePincodeBtn = screen.getByRole("button", { name: /Mostra pincode/i });
    await user.click(togglePincodeBtn);
    expect(pincodeInput).toHaveAttribute("type", "text");

    const hidePincodeBtn = screen.getByRole("button", { name: /Nascondi pincode/i });
    await user.click(hidePincodeBtn);
    expect(pincodeInput).toHaveAttribute("type", "password");
  });

  it("invia i dati alla Server Action e mostra il messaggio di successo", async () => {
    const user = userEvent.setup();
    mockSaveSistemaTsSettings.mockResolvedValueOnce({ success: true });

    render(<SistemaTsForm {...defaultProps} />);

    const usernameInput = screen.getByLabelText(/Username \/ Codice Fiscale/i);
    const passwordInput = screen.getByLabelText(/^Password TS/i);
    const pincodeInput = screen.getByLabelText(/^PinCode TS/i);

    await user.clear(usernameInput);
    await user.type(usernameInput, "RSSMRA80A01H501Z");
    await user.type(passwordInput, "Mypasw0rd!");
    await user.type(pincodeInput, "12345678");

    const submitBtn = screen.getByRole("button", { name: /Salva Impostazioni/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockSaveSistemaTsSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "RSSMRA80A01H501Z",
          password: "Mypasw0rd!",
          pincode: "12345678",
          naturaIvaDefault: "N2.2",
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Impostazioni Sistema TS salvate con successo/i)).toBeInTheDocument();
    });
  });

  it("mostra il messaggio di errore restituito dalla Server Action", async () => {
    const user = userEvent.setup();
    mockSaveSistemaTsSettings.mockResolvedValueOnce({ error: "Errore credenziali ministeriali" });

    render(<SistemaTsForm {...defaultProps} />);

    const usernameInput = screen.getByLabelText(/Username \/ Codice Fiscale/i);
    const passwordInput = screen.getByLabelText(/^Password TS/i);
    const pincodeInput = screen.getByLabelText(/^PinCode TS/i);

    await user.clear(usernameInput);
    await user.type(usernameInput, "RSSMRA80A01H501Z");
    await user.type(passwordInput, "Mypasw0rd!");
    await user.type(pincodeInput, "12345678");

    const submitBtn = screen.getByRole("button", { name: /Salva Impostazioni/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Errore credenziali ministeriali")).toBeInTheDocument();
    });
  });
});
