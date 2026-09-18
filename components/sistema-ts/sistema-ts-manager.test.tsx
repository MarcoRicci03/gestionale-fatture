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
const mockCorreggiFatturaTs = vi.fn();
vi.mock("@/lib/actions/sistema-ts", () => ({
  inviaLottoFatture: (...args: unknown[]) => mockInviaLottoFatture(...args),
  annullaFatturaTs: (...args: unknown[]) => mockAnnullaFatturaTs(...args),
  ripristinaFatturaPerReinvio: (...args: unknown[]) => mockRipristinaFatturaPerReinvio(...args),
  correggiFatturaTs: (...args: unknown[]) => mockCorreggiFatturaTs(...args),
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
      importoValido: true,
      richiedeBollo: true,
      bolloMancante: false,
      isDataFutura: false,
      dataEffettiva: new Date("2026-03-10T10:00:00Z"),
      haAnomalie: false,
      isProntaPerInvio: true,
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
      importoValido: true,
      richiedeBollo: true,
      bolloMancante: true,
      isDataFutura: false,
      dataEffettiva: new Date("2026-03-12T10:00:00Z"),
      haAnomalie: true,
      isProntaPerInvio: false,
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
      importoValido: true,
      richiedeBollo: true,
      bolloMancante: false,
      isDataFutura: false,
      dataEffettiva: new Date("2026-03-01T10:00:00Z"),
      haAnomalie: false,
      isProntaPerInvio: false,
    },
    {
      id: 4,
      n_fattura: 4,
      anno: 2026,
      data: new Date("2026-03-15T10:00:00Z"),
      data_pagamento: new Date("2099-12-31T10:00:00Z"),
      prezzo_totale: 120,
      mod_pag: "BONIFICO",
      pagamento_tracciato: true,
      natura_iva: "N2.2",
      flag_opposizione: false,
      bollo: 0,
      bolloCodice: null,
      stato_ts: "DA_INVIARE",
      protocollo_ts: null,
      protocollo_cancellazione_ts: null,
      data_invio_ts: null,
      paganteNomeCompleto: "Marco Neri",
      paganteCf: "NRIMRC85M01H501U",
      pazienteNomeCompleto: "Marco Neri",
      cfValido: true,
      importoValido: true,
      richiedeBollo: false,
      bolloMancante: false,
      isDataFutura: true,
      dataEffettiva: new Date("2099-12-31T10:00:00Z"),
      haAnomalie: false,
      isProntaPerInvio: false,
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

  it("renderizza l'intestazione, le pillole di navigazione e i badge della tabella", async () => {
    const user = userEvent.setup();
    render(<SistemaTsManager {...defaultProps} />);

    expect(screen.getByRole("heading", { name: /Sistema Tessera Sanitaria/i, level: 1 })).toBeInTheDocument();

    // Le 4 pillole con i rispettivi conteggi sono presenti
    expect(screen.getByRole("button", { name: /Pronte all'invio/i })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /Da correggere/i })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /Incassi futuri/i })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /Tutte/i })).toHaveTextContent("3");

    // Di default è attiva la vista 'Pronte all'invio': solo Luigi Bianchi è visibile
    expect(screen.getAllByText("Luigi Bianchi")[0]).toBeInTheDocument();
    expect(screen.queryByText("Mario Rossi")).not.toBeInTheDocument();
    expect(screen.queryByText("Marco Neri")).not.toBeInTheDocument();

    // Cliccando sulla pillola "Tutte", compaiono anche Mario Rossi e Marco Neri
    await user.click(screen.getByRole("button", { name: /Tutte/i }));
    expect(screen.getAllByText("Mario Rossi")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Marco Neri")[0]).toBeInTheDocument();

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

  it("disabilita la checkbox per fatture con anomalie (CF errato) e fornisce azione rapida Correggi", async () => {
    const user = userEvent.setup();
    render(<SistemaTsManager {...defaultProps} />);

    // Passa alla pillola "Da correggere"
    await user.click(screen.getByRole("button", { name: /Da correggere/i }));

    expect(screen.getAllByText("Mario Rossi")[0]).toBeInTheDocument();

    // La checkbox deve essere disabilitata con tooltip esplicativo
    const checkbox2 = screen.getByLabelText("Seleziona fattura 2");
    expect(checkbox2).toBeDisabled();
    expect(checkbox2.getAttribute("title")).toContain("Lunghezza errata");

    // Deve essere presente il pulsante Correggi rapido in-place
    const correggiButtons = screen.getAllByRole("button", { name: /Correggi/i });
    expect(correggiButtons.length).toBeGreaterThan(0);

    // Cliccando sul pulsante Correggi, si apre la modale di correzione in-place
    await user.click(correggiButtons[0]);
    expect(screen.getByRole("heading", { name: /Correggi dati per Sistema TS/i })).toBeInTheDocument();
  });

  it("disabilita la checkbox per fatture con incasso futuro e mostra tooltip esplicativo", async () => {
    const user = userEvent.setup();
    render(<SistemaTsManager {...defaultProps} />);

    // Passa alla pillola "Incassi futuri"
    await user.click(screen.getByRole("button", { name: /Incassi futuri/i }));

    expect(screen.getAllByText("Marco Neri")[0]).toBeInTheDocument();

    // Checkbox disabilitata con tooltip per data futura
    const checkbox4 = screen.getByLabelText("Seleziona fattura 4");
    expect(checkbox4).toBeDisabled();
    expect(checkbox4.getAttribute("title")).toContain("Non inviabile oggi");

    // Badge Incasso futuro presente
    expect(screen.getAllByText(/Incasso futuro/i).length).toBeGreaterThan(0);
  });

  it("seleziona tutte include esclusivamente le fatture pronte ignorando anomalie e incassi futuri", async () => {
    const user = userEvent.setup();
    render(<SistemaTsManager {...defaultProps} />);

    // Nella vista "Tutte" sono presenti 3 fatture (1 pronta, 1 da correggere, 1 futura)
    await user.click(screen.getByRole("button", { name: /Tutte/i }));

    const selectAll = screen.getByLabelText("Seleziona tutte le fatture");
    await user.click(selectAll);

    // Solo la fattura 1 (pronta) deve risultare selezionata
    expect(screen.getByText("1 fattura selezionata per l'invio")).toBeInTheDocument();
    expect(screen.getByLabelText("Seleziona fattura 1")).toBeChecked();
    expect(screen.getByLabelText("Seleziona fattura 2")).not.toBeChecked();
    expect(screen.getByLabelText("Seleziona fattura 4")).not.toBeChecked();
  });

  it("blocca il pulsante d'invio e mostra avviso se viene selezionata una fattura con importo non valido per TS", async () => {
    const user = userEvent.setup();
    const propsWithInvalidImporto = {
      ...defaultProps,
      fatture: [
        {
          ...defaultProps.fatture[0],
          id: 99,
          prezzo_totale: 0,
          importoValido: false,
          importoErrore: "L'importo (0.00 €) deve essere maggiore di zero (minimo 0,01 € per tracciato Sistema TS)",
          haAnomalie: true,
          isProntaPerInvio: false,
        },
      ],
    };
    render(<SistemaTsManager {...propsWithInvalidImporto} />);

    // Essendo anomala, appare nella tab Da correggere
    await user.click(screen.getByRole("button", { name: /Da correggere/i }));

    const checkbox = screen.getByLabelText("Seleziona fattura 1");
    expect(checkbox).toBeDisabled();
    expect(checkbox.getAttribute("title")).toContain("L'importo (0.00 €) deve essere maggiore di zero");
  });

  it("apre la modale di conferma con verifiche di conformità ed alert normativo ed esegue l'invio batch", async () => {
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

    // Verifiche di conformità e alert fiscale presenti
    expect(screen.getByText(/Verifiche preventive superate con successo/i)).toBeInTheDocument();
    expect(screen.getByText(/Date incasso conformi/i)).toBeInTheDocument();
    expect(screen.getByText(/Rilevanza fiscale per il 730 precompilato/i)).toBeInTheDocument();

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

    render(
      <SistemaTsManager
        {...defaultProps}
        filters={{
          ...defaultProps.filters,
          stato: "INVIATA",
        }}
      />
    );

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

  it("visualizza la data di incasso quando data_pagamento è presente", () => {
    const fatturaConPagamento: FatturaTsListItem = {
      ...mockFatture[0],
      id: 99,
      n_fattura: 99,
      data: new Date("2026-03-10T10:00:00Z"),
      data_pagamento: new Date("2026-03-15T12:00:00Z"),
    };

    render(<SistemaTsManager {...defaultProps} fatture={[fatturaConPagamento]} />);

    expect(screen.getAllByText(/Incasso:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("15/03/2026").length).toBeGreaterThan(0);
  });

  it("renderizza la guida all'azione e il report errori strutturato nello Storico Trasmissioni", async () => {
    const user = userEvent.setup();
    const mockTrasmissione = {
      id: 101,
      protocollo: "PROT-2026-TEST",
      nomeFile: "invio_20260310.zip",
      dataInvio: new Date("2026-03-10T10:00:00Z"),
      statoElaborazione: "3",
      codiceEsito: null,
      descrizioneEsito: "Elaborato con errori",
      numRicevuti: 1,
      totaleFatture: 1,
      numAccolti: 0,
      numScartati: 1,
      numWarning: 0,
      hasCsvErrori: true,
      csvErrori: "1;S050;CF CITTADINO FORMALMENTE ERRATO;ERRORE\n",
      hasPdfRicevuta: false,
      fatture: [
        {
          id: 1,
          n_fattura: 1,
          anno: 2026,
          data: new Date("2026-03-10T10:00:00Z"),
          prezzo_totale: 100,
          paganteNome: "Luigi Bianchi",
          paganteCf: "BNCLGI75C12F205E",
          stato_ts: "DA_INVIARE" as const,
          esitoFattura: "SCARTATA" as const,
          errori: [
            {
              codiceErrore: "S050",
              tipo: "ERRORE" as const,
              descrizione: "CF CITTADINO FORMALMENTE ERRATO",
            },
          ],
        },
      ],
    };

    render(
      <SistemaTsManager
        {...defaultProps}
        trasmissioni={[mockTrasmissione]}
      />
    );

    // Passa alla tab Storico Trasmissioni
    const storicoTab = screen.getByRole("button", { name: /Storico Trasmissioni/i });
    await user.click(storicoTab);

    // Espandi il dettaglio delle fatture della trasmissione
    const detailBtn = screen.getByRole("button", { name: /Dettaglio fatture/i });
    await user.click(detailBtn);

    // Nello Storico Trasmissioni, la riga/card della fattura scartata mostra l'helper e 'Cosa fare'
    expect(screen.getAllByText(/\[S050\] Codice Fiscale formalmente errato/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cosa fare:/i).length).toBeGreaterThan(0);

    // Clicca sul pulsante 'Report Errori'
    const reportBtn = screen.getByRole("button", { name: /Report Errori/i });
    await user.click(reportBtn);

    // Si apre la modale di dettaglio anomalie con tab Guida Anomalie e CSV Originale
    expect(screen.getByRole("heading", { name: /Report Errori e Segnalazioni Sogei/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guida Anomalie/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /CSV Originale/i })).toBeInTheDocument();

    // Mostra la fattura documento raggruppata
    expect(screen.getByText(/Fattura Documento N./i)).toBeInTheDocument();

    // Passa alla visualizzazione CSV Originale
    const csvBtn = screen.getByRole("button", { name: /CSV Originale/i });
    await user.click(csvBtn);
    expect(screen.getByText(/CF CITTADINO FORMALMENTE ERRATO;ERRORE/i)).toBeInTheDocument();
  });

  it("il reset dei filtri azzera la selezione e reindirizza allo stato predefinito DA_INVIARE", async () => {
    const user = userEvent.setup();
    render(<SistemaTsManager {...defaultProps} />);

    // Seleziona la prima fattura idonea
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);

    expect(screen.getByText(/1 fattura selezionata per l'invio/i)).toBeInTheDocument();

    // Clicca sul pulsante Reset Filtri
    const resetBtn = screen.getByRole("button", { name: /Azzera filtri/i });
    await user.click(resetBtn);

    // Reindirizza all'URL con stato DA_INVIARE
    expect(mockPush).toHaveBeenCalledWith("/sistema-ts?stato=DA_INVIARE");

    // L'action bar di selezione non deve essere più visibile (selezione azzerata)
    expect(screen.queryByText(/fattura selezionata per l'invio/i)).not.toBeInTheDocument();
  });

  it("il cambio dei filtri prop azzera la selezione ed evita trasmissioni fantasma", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SistemaTsManager {...defaultProps} />);

    // Seleziona la prima fattura (id: 1)
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);

    expect(screen.getByText(/1 fattura selezionata per l'invio/i)).toBeInTheDocument();

    // Rerender con nuovi filtri (es. cambio intervallo date in cui id: 1 non ricade)
    rerender(
      <SistemaTsManager
        {...defaultProps}
        filters={{
          dateFrom: "2026-04-01",
          dateTo: "2026-04-30",
          stato: "DA_INVIARE",
        }}
        fatture={[]}
      />
    );

    // L'action bar di selezione deve essere sparita e non inviare nulla
    expect(screen.queryByText(/fattura selezionata per l'invio/i)).not.toBeInTheDocument();
    expect(mockInviaLottoFatture).not.toHaveBeenCalled();
  });

  it("mostra il toast in alto a destra dopo un'azione e permette di chiuderlo con il pulsante X", async () => {
    const user = userEvent.setup();
    mockInviaLottoFatture.mockResolvedValueOnce({
      success: true,
      protocollo: "PROT-TOAST-123",
      message: "Lotto inviato con successo",
    });

    render(<SistemaTsManager {...defaultProps} />);

    // Seleziona e invia
    const checkbox1 = screen.getByLabelText("Seleziona fattura 1");
    await user.click(checkbox1);

    const sendBtn = screen.getByRole("button", { name: /Invia a Sistema TS \(1\)/i });
    await user.click(sendBtn);

    const confirmBtn = screen.getByRole("button", { name: /Conferma e Invia/i });
    await user.click(confirmBtn);

    // Il toast compare con role="status" e classe fixed top-4 right-4
    const toast = await screen.findByRole("status");
    expect(toast).toHaveClass("fixed", "right-4", "top-4");
    expect(toast).toHaveTextContent(/Lotto inviato con successo/i);

    // Cliccando sulla 'X', il toast scompare
    const closeBtn = screen.getByRole("button", { name: /Chiudi notifica/i });
    await user.click(closeBtn);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
