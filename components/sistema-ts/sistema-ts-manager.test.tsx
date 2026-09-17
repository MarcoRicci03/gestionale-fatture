import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SistemaTsManager } from "./sistema-ts-manager";
import type { FatturaTsListItem } from "@/lib/data/sistema-ts";

// Mock router
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock Server Actions
const mockInviaLottoFatture = vi.fn();
const mockAnnullaFatturaTs = vi.fn();
const mockRipristinaFatturaPerReinvio = vi.fn();
vi.mock("@/lib/actions/sistema-ts", () => ({
  inviaLottoFatture: (...args: unknown[]) => mockInviaLottoFatture(...args),
  annullaFatturaTs: (...args: unknown[]) => mockAnnullaFatturaTs(...args),
  ripristinaFatturaPerReinvio: (...args: unknown[]) => mockRipristinaFatturaPerReinvio(...args),
  sincronizzaEsitoTrasmissione: vi.fn(),
  getRicevutaPdfBase64: vi.fn(),
}));

describe("SistemaTsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockFatture: FatturaTsListItem[] = [
    {
      id: 1,
      n_fattura: 1,
      anno: 2026,
      data: new Date("2026-03-10T10:00:00Z"),
      prezzo_totale: 100,
      mod_pag: "BONIFICO",
      pagamento_tracciato: true,
      natura_iva: "N2.2",
      flag_opposizione: false,
      bollo: 2,
      bolloCodice: "01234567890123",
      stato_ts: "DA_INVIARE",
      protocollo_ts: null,
      protocollo_cancellazione_ts: null,
      data_invio_ts: null,
      paganteNomeCompleto: "Luigi Bianchi",
      paganteCf: "BNCLGI75C12F205E",
      pazienteNomeCompleto: "Luigi Bianchi",
      cfValido: true,
      richiedeBollo: true,
      bolloMancante: false,
    },
    {
      id: 2,
      n_fattura: 2,
      anno: 2026,
      data: new Date("2026-03-12T10:00:00Z"),
      prezzo_totale: 150,
      mod_pag: "CARTA",
      pagamento_tracciato: true,
      natura_iva: "N2.2",
      flag_opposizione: false,
      bollo: 2,
      bolloCodice: null,
      stato_ts: "DA_INVIARE",
      protocollo_ts: null,
      protocollo_cancellazione_ts: null,
      data_invio_ts: null,
      paganteNomeCompleto: "Mario Rossi",
      paganteCf: "INVALID_CF",
      pazienteNomeCompleto: "Mario Rossi",
      cfValido: false,
      cfErrore: "Lunghezza errata",
      richiedeBollo: true,
      bolloMancante: true,
    },
    {
      id: 3,
      n_fattura: 3,
      anno: 2026,
      data: new Date("2026-03-01T10:00:00Z"),
      prezzo_totale: 80,
      mod_pag: "BONIFICO",
      pagamento_tracciato: true,
      natura_iva: "N2.2",
      flag_opposizione: false,
      bollo: 2,
      bolloCodice: "01234567890124",
      stato_ts: "INVIATA",
      protocollo_ts: "PROT-2026-001",
      protocollo_cancellazione_ts: null,
      data_invio_ts: new Date("2026-03-02T10:00:00Z"),
      paganteNomeCompleto: "Anna Verdi",
      paganteCf: "VRDNNA80A41H501Z",
      pazienteNomeCompleto: "Anna Verdi",
      cfValido: true,
      richiedeBollo: true,
      bolloMancante: false,
    },
  ];

  const defaultProps = {
    fatture: mockFatture,
    trasmissioni: [],
    hasSettings: true,
    filters: {
      dateFrom: "",
      dateTo: "",
      stato: "DA_INVIARE",
    },
  };

  it("renderizza l'intestazione e i badge della tabella", () => {
    render(<SistemaTsManager {...defaultProps} />);

    expect(screen.getByRole("heading", { name: /Sistema Tessera Sanitaria/i, level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("Luigi Bianchi")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Mario Rossi")[0]).toBeInTheDocument();

    // Bollo con codice e senza codice
    expect(screen.getAllByText(/2,00 € \(senza codice\)/i)[0]).toBeInTheDocument();
  });

  it("mostra l'avviso se le credenziali non sono configurate (hasSettings: false)", () => {
    render(<SistemaTsManager {...defaultProps} hasSettings={false} />);

    expect(
      screen.getByText(/Non hai ancora configurato le credenziali del Sistema TS/i)
    ).toBeInTheDocument();
  });

  it("selezione singola e calcolo totale importo nell'action bar", async () => {
    const user = userEvent.setup();
    render(<SistemaTsManager {...defaultProps} />);

    // Seleziona la prima fattura (id: 1, 100 €)
    const checkbox1 = screen.getByLabelText("Seleziona fattura 1");
    await user.click(checkbox1);

    expect(screen.getByText("1 fattura selezionata per l'invio")).toBeInTheDocument();
    expect(screen.getByText(/Totale importo onorari: 100,00/i)).toBeInTheDocument();

    // Il pulsante invio è abilitato (ha CF valido)
    const sendBtn = screen.getByRole("button", { name: /Invia a Sistema TS \(1\)/i });
    expect(sendBtn).not.toBeDisabled();
  });

  it("blocca il pulsante d'invio e mostra avviso rosso se viene selezionata una fattura con CF errato", async () => {
    const user = userEvent.setup();
    render(<SistemaTsManager {...defaultProps} />);

    // Seleziona la fattura 2 (id: 2, CF invalido)
    const checkbox2 = screen.getByLabelText("Seleziona fattura 2");
    await user.click(checkbox2);

    expect(screen.getByText("1 fattura selezionata per l'invio")).toBeInTheDocument();
    expect(screen.getByText("(1 con Codice Fiscale errato)")).toBeInTheDocument();

    // Il pulsante di invio DEVE essere disabilitato
    const sendBtn = screen.getByRole("button", { name: /Invia a Sistema TS \(1\)/i });
    expect(sendBtn).toBeDisabled();
  });

  it("apre la modale di conferma ed esegue l'invio batch", async () => {
    const user = userEvent.setup();
    mockInviaLottoFatture.mockResolvedValueOnce({
      success: true,
      protocollo: "PROT-TEST-12345",
      message: "Lotto inviato con successo",
    });

    render(<SistemaTsManager {...defaultProps} />);

    // Seleziona la fattura 1 (valida)
    const checkbox1 = screen.getByLabelText("Seleziona fattura 1");
    await user.click(checkbox1);

    const sendBtn = screen.getByRole("button", { name: /Invia a Sistema TS \(1\)/i });
    await user.click(sendBtn);

    // Dialog di conferma aperto
    expect(screen.getByRole("heading", { name: /Conferma invio a Sistema TS/i })).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /Conferma e Invia/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockInviaLottoFatture).toHaveBeenCalledWith([1]);
    });

    await waitFor(() => {
      expect(screen.getByText(/Lotto inviato con successo/i)).toBeInTheDocument();
    });
  });

  it("gestisce la cancellazione telematica con validazione dati di sicurezza (Annulla TS)", async () => {
    const user = userEvent.setup();
    mockAnnullaFatturaTs.mockResolvedValueOnce({
      success: true,
      protocollo: "CANC-TEST-999",
      message: "Richiesta di cancellazione inviata",
    });

    render(<SistemaTsManager {...defaultProps} />);

    // Trova il pulsante Annulla TS per la fattura 3 (INVIATA)
    const cancelButtons = screen.getAllByRole("button", { name: /Annulla TS/i });
    expect(cancelButtons.length).toBeGreaterThan(0);
    await user.click(cancelButtons[0]);

    // Modale di conferma annullamento
    expect(screen.getByRole("heading", { name: /Annullamento Spesa su Sistema TS/i })).toBeInTheDocument();

    // Compila i 3 campi di sicurezza per sbloccare la cancellazione
    const numeroInput = screen.getByLabelText(/Numero fattura/i);
    const dataInput = screen.getByLabelText(/Data emissione/i);
    const intestatarioInput = screen.getByLabelText(/Intestatario fattura/i);

    await user.type(numeroInput, "3");
    await user.type(dataInput, "01032026");
    await user.type(intestatarioInput, "Anna Verdi");

    const confirmCancelBtn = screen.getByRole("button", { name: /Conferma Cancellazione/i });
    expect(confirmCancelBtn).not.toBeDisabled();
    await user.click(confirmCancelBtn);

    await waitFor(() => {
      expect(mockAnnullaFatturaTs).toHaveBeenCalledWith(3);
    });

    await waitFor(() => {
      expect(screen.getByText(/Richiesta di cancellazione inviata/i)).toBeInTheDocument();
    });
  });

  it("applica i filtri tramite router.push", async () => {
    const user = userEvent.setup();
    render(<SistemaTsManager {...defaultProps} />);

    const filterBtn = screen.getByRole("button", { name: /Filtra/i });
    await user.click(filterBtn);

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/sistema-ts?"));
  });
});
