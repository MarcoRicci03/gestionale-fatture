import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FixInvoiceTsDialog } from "./fix-invoice-ts-dialog";
import type { FatturaTsListItem } from "@/lib/data/sistema-ts";

const mockCorreggiFatturaTs = vi.fn();
vi.mock("@/lib/actions/sistema-ts", () => ({
  correggiFatturaTs: (...args: unknown[]) => mockCorreggiFatturaTs(...args),
}));

describe("FixInvoiceTsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseInvoice: FatturaTsListItem = {
    id: 10,
    n_fattura: 4,
    anno: 2026,
    data: new Date("2026-03-01T12:00:00Z"),
    dataEffettiva: new Date("2026-03-01T12:00:00Z"),
    prezzo_totale: 100,
    mod_pag: "BONIFICO",
    pagamento_tracciato: true,
    natura_iva: "N2.2",
    flag_opposizione: false,
    bollo: 2,
    bolloCodice: null,
    stato_ts: "DA_INVIARE",
    protocollo_ts: null,
    protocollo_cancellazione_ts: null,
    data_invio_ts: null,
    paganteNomeCompleto: "Rossi Mario",
    paganteCf: "WRONG_CF",
    pazienteNomeCompleto: "Rossi Luigi",
    cfValido: false,
    cfErrore: "Lunghezza errata: attesi 16 caratteri",
    importoValido: true,
    richiedeBollo: true,
    bolloMancante: true,
    isDataFutura: false,
    haAnomalie: true,
    isProntaPerInvio: false,
    id_Pagante: 100,
  };

  it("renderizza correttamente i dati della fattura e il banner anomalie", () => {
    render(
      <FixInvoiceTsDialog
        invoice={baseInvoice}
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        otherDraftsCount={2}
      />
    );

    expect(screen.getByText(/Fattura #4\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/Rossi Mario/)).toBeInTheDocument();
    expect(screen.getByText(/Anomalie rilevate/)).toBeInTheDocument();
    expect(screen.getAllByText(/Lunghezza errata/).length).toBeGreaterThan(0);
  });

  it("mostra la checkbox di propagazione con il conteggio corretto quando otherDraftsCount > 0", () => {
    render(
      <FixInvoiceTsDialog
        invoice={baseInvoice}
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        otherDraftsCount={3}
      />
    );

    expect(
      screen.getByText(/Applica la correzione anche alle altre 3 fatture non ancora inviate/i)
    ).toBeInTheDocument();
  });

  it("NON mostra la checkbox di propagazione se otherDraftsCount è 0", () => {
    render(
      <FixInvoiceTsDialog
        invoice={baseInvoice}
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        otherDraftsCount={0}
      />
    );

    expect(
      screen.queryByText(/Applica la correzione anche alle altre/i)
    ).not.toBeInTheDocument();
  });

  it("mostra validazione CIN in tempo reale durante la digitazione del Codice Fiscale", async () => {
    const user = userEvent.setup();
    render(
      <FixInvoiceTsDialog
        invoice={baseInvoice}
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const inputCf = screen.getByLabelText(/Codice Fiscale Pagante/i);

    // Inserisci CF valido
    await user.clear(inputCf);
    await user.type(inputCf, "RSSMRA80A01H501U");

    expect(screen.getByText(/CF Valido \(CIN verificato\)/i)).toBeInTheDocument();
  });

  it("invia i dati corretti alla Server Action e gestisce il successo", async () => {
    const user = userEvent.setup();
    const mockOnSuccess = vi.fn();
    const mockOnOpenChange = vi.fn();

    mockCorreggiFatturaTs.mockResolvedValueOnce({
      success: true,
      message: "Fattura corretta con successo",
    });

    render(
      <FixInvoiceTsDialog
        invoice={baseInvoice}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
        otherDraftsCount={2}
      />
    );

    const inputCf = screen.getByLabelText(/Codice Fiscale Pagante/i);
    await user.clear(inputCf);
    await user.type(inputCf, "RSSMRA80A01H501U");

    // Spunta la propagazione
    const propagationCheckbox = screen.getByLabelText(/Applica la correzione anche alle altre 2 fatture/i);
    await user.click(propagationCheckbox);

    // Salva
    const submitBtn = screen.getByRole("button", { name: /Salva correzioni/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockCorreggiFatturaTs).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: 10,
          paganteCf: "RSSMRA80A01H501U",
          propagaFattureInAttesa: true,
          aggiornaAnagrafica: true,
          flagOpposizione: false,
        })
      );
    });

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockOnSuccess).toHaveBeenCalledWith("Fattura corretta con successo");
  });

  it("mostra errore restituito dal server in caso di fallimento", async () => {
    const user = userEvent.setup();
    mockCorreggiFatturaTs.mockResolvedValueOnce({
      error: "Codice Fiscale già associato ad un altro cliente",
    });

    render(
      <FixInvoiceTsDialog
        invoice={baseInvoice}
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const inputCf = screen.getByLabelText(/Codice Fiscale Pagante/i);
    await user.clear(inputCf);
    await user.type(inputCf, "RSSMRA80A01H501U");

    const submitBtn = screen.getByRole("button", { name: /Salva correzioni/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Codice Fiscale già associato ad un altro cliente")).toBeInTheDocument();
    });
  });

  it("permette il salvataggio con opposizione senza Codice Fiscale", async () => {
    const user = userEvent.setup();
    mockCorreggiFatturaTs.mockResolvedValueOnce({
      success: true,
      message: "Fattura corretta con opposizione",
    });

    render(
      <FixInvoiceTsDialog
        invoice={baseInvoice}
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    // Attiva opposizione
    const opposizioneCheckbox = screen.getByLabelText(/Il paziente esercita opposizione/i);
    await user.click(opposizioneCheckbox);

    // Sottometti
    const submitBtn = screen.getByRole("button", { name: /Salva correzioni/i });
    expect(submitBtn).not.toBeDisabled();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockCorreggiFatturaTs).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: 10,
          flagOpposizione: true,
        })
      );
    });
  });
});
