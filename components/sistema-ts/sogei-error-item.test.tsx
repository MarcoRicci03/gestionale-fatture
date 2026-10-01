import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SogeiErrorItem } from "./sogei-error-item";
import type { ErroreDocumentoTs } from "@/lib/sistemats/csv-parser";

describe("SogeiErrorItem", () => {
  it("renderizza un errore bloccante (S050) con titolo, motivo e guida 'Cosa fare'", () => {
    const error: ErroreDocumentoTs = {
      codiceErrore: "S050",
      tipo: "ERRORE",
      descrizione: "CF CITTADINO FORMALMENTE ERRATO",
    };

    render(<SogeiErrorItem error={error} />);

    expect(screen.getByText(/\[S050\] Codice Fiscale formalmente errato/i)).toBeInTheDocument();
    expect(screen.getByText(/CF CITTADINO FORMALMENTE ERRATO/i)).toBeInTheDocument();
    expect(screen.getByText(/Cosa fare:/i)).toBeInTheDocument();
    expect(screen.getByText(/Correggi il Codice Fiscale nell'anagrafica/i)).toBeInTheDocument();
  });

  it("renderizza un warning (W003) evidenziando che la spesa è stata accolta", () => {
    const warning: ErroreDocumentoTs = {
      codiceErrore: "W003",
      tipo: "WARNING",
      descrizione: "SEGNALAZIONE NON BLOCCANTE",
    };

    render(<SogeiErrorItem error={warning} />);

    expect(screen.getByText(/\[W003\] Anomalia formale non bloccante \(Spesa Accolta\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Cosa fare:/i)).toBeInTheDocument();
    expect(screen.getByText(/Nessuna azione richiesta/i)).toBeInTheDocument();
  });

  it("renderizza un codice S017 come info già presente nel Sistema TS", () => {
    const s017: ErroreDocumentoTs = {
      codiceErrore: "S017",
      tipo: "ERRORE",
      descrizione: "IDENTIFICATIVO DOCUMENTO FISCALE GIA' PRESENTE",
    };

    render(<SogeiErrorItem error={s017} />);

    expect(screen.getByText(/\[S017\] Documento già presente nel Sistema TS/i)).toBeInTheDocument();
    expect(screen.getByText(/Questa fattura risulta già acquisita nei server ministeriali/i)).toBeInTheDocument();
    expect(screen.getByText(/non occorre reinviarla/i)).toBeInTheDocument();
  });

  it("nasconde il box 'Cosa fare' se showGuidance è impostato su false", () => {
    const error: ErroreDocumentoTs = {
      codiceErrore: "S003",
      tipo: "ERRORE",
      descrizione: "CF NON PRESENTE",
    };

    render(<SogeiErrorItem error={error} showGuidance={false} />);

    expect(screen.getByText(/\[S003\] Codice Fiscale non presente in Anagrafe Tributaria/i)).toBeInTheDocument();
    expect(screen.queryByText(/Cosa fare:/i)).not.toBeInTheDocument();
  });
});
