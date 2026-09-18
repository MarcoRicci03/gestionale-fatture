import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SogeiErrorBadge } from "./sogei-error-badge";
import type { ErroreDocumentoTs } from "@/lib/sistemats/csv-parser";

describe("SogeiErrorBadge", () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 120,
      height: 32,
      top: 50,
      left: 50,
      bottom: 82,
      right: 170,
      x: 50,
      y: 50,
      toJSON: () => {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("renderizza la pillola compatta con codice ed etichetta sintetica per W008", () => {
    const error: ErroreDocumentoTs = {
      codiceErrore: "W008",
      tipo: "WARNING",
      descrizione: "IL DOCUMENTO E' STATO TRASMESSO OLTRE I TERMINI PREVISTI",
    };

    render(<SogeiErrorBadge error={error} />);

    // Verifica presenza del codice e dell'etichetta sintetica (Opzione B)
    expect(screen.getByText(/\[W008\]/i)).toBeInTheDocument();
    expect(screen.getByText(/Oltre i termini/i)).toBeInTheDocument();
  });

  it("renderizza la pillola compatta per un warning non bloccante (W003)", () => {
    const warning: ErroreDocumentoTs = {
      codiceErrore: "W003",
      tipo: "WARNING",
      descrizione: "IL CF CITTADINO NON PRESENTE IN ARCHIVIO",
    };

    render(<SogeiErrorBadge error={warning} />);

    expect(screen.getByText(/\[W003\]/i)).toBeInTheDocument();
    expect(screen.getByText(/Spesa accolta/i)).toBeInTheDocument();
  });

  it("renderizza la pillola compatta per uno scarto ministeriale (S050)", () => {
    const error: ErroreDocumentoTs = {
      codiceErrore: "S050",
      tipo: "ERRORE",
      descrizione: "CF CITTADINO FORMALMENTE ERRATO",
    };

    render(<SogeiErrorBadge error={error} />);

    expect(screen.getByText(/\[S050\]/i)).toBeInTheDocument();
    expect(screen.getByText(/CF errato/i)).toBeInTheDocument();
  });

  it("renderizza la pillola compatta per una spesa già registrata (S017)", () => {
    const s017: ErroreDocumentoTs = {
      codiceErrore: "S017",
      tipo: "ERRORE",
      descrizione: "IDENTIFICATIVO DOCUMENTO FISCALE GIA' PRESENTE",
    };

    render(<SogeiErrorBadge error={s017} />);

    expect(screen.getByText(/\[S017\]/i)).toBeInTheDocument();
    expect(screen.getByText(/Già presente su TS/i)).toBeInTheDocument();
  });

  it("mostra i dettagli completi, il tracciato e 'Cosa fare' quando viene cliccato/attivato", async () => {
    const user = userEvent.setup();
    const error: ErroreDocumentoTs = {
      codiceErrore: "W008",
      tipo: "WARNING",
      descrizione: "IL DOCUMENTO E' STATO TRASMESSO OLTRE I TERMINI PREVISTI",
    };

    render(<SogeiErrorBadge error={error} />);

    const trigger = screen.getByRole("button", { name: /Dettagli anomalia W008/i });
    await user.click(trigger);

    // Nel popover deve essere presente il titolo, il tracciato ministeriale e la guida
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/Trasmesso oltre i termini previsti/i);
    expect(dialog).toHaveTextContent(/IL DOCUMENTO E' STATO TRASMESSO OLTRE I TERMINI PREVISTI/i);
    expect(dialog).toHaveTextContent(/Cosa fare:/i);
    expect(dialog).toHaveTextContent(/Nessuna azione richiesta per questo invio/i);

    // Verifica che il popup e il suo positioner abbiano z-50 per stare sopra gli header sticky (z-10)
    expect(dialog).toHaveClass("z-50");
    const positioner = dialog.closest("[role='presentation']");
    expect(positioner).toHaveClass("z-50");
    expect(positioner).toHaveClass("isolate");
  });
});
