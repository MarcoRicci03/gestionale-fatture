import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Pagante } from "@prisma/client";
import { PayerDetailDialog } from "./payer-detail-dialog";

function makePagante(overrides: Partial<Pagante> = {}): Pagante {
  return {
    id: 1,
    id_Utente: 1,
    nome: "Mario",
    cognome: "Rossi",
    via: "Via Roma 1",
    citta: "Roma",
    cap: "00100",
    cf: "RSSMRA80A01H501Z",
    piva: null,
    archiviato: false,
    ...overrides,
  } as Pagante;
}

function renderDialog(
  overrides: Partial<Parameters<typeof PayerDetailDialog>[0]> = {}
) {
  return render(
    <PayerDetailDialog
      payer={overrides.payer ?? makePagante()}
      onOpenChange={vi.fn()}
      {...overrides}
    />
  );
}

describe("PayerDetailDialog", () => {
  it("payer null: il dialog resta chiuso, nessun campo renderizzato", () => {
    renderDialog({ payer: null });
    expect(screen.queryByText("Dettagli Pagante")).not.toBeInTheDocument();
  });

  it("renderizza i campi del pagante", () => {
    const payer = makePagante({
      nome: "Luca",
      cognome: "Verdi",
      via: "Via Milano 5",
      citta: "Milano",
      cap: "20100",
      cf: "VRDLCU80A01F205Z",
      piva: "12345678901",
    });
    renderDialog({ payer });

    expect(screen.getByText("Dettagli Pagante")).toBeInTheDocument();
    expect(screen.getByText("Verdi")).toBeInTheDocument();
    expect(screen.getByText("Luca")).toBeInTheDocument();
    expect(screen.getByText("Via Milano 5, Milano 20100")).toBeInTheDocument();
    expect(screen.getByText("VRDLCU80A01F205Z")).toBeInTheDocument();
    expect(screen.getByText("12345678901")).toBeInTheDocument();
  });

  it("cf/piva null: mostra '-' come fallback", () => {
    renderDialog({ payer: makePagante({ cf: null, piva: null }) });
    const dashes = screen.getAllByText("-");
    expect(dashes).toHaveLength(2);
  });

  it("onOpenChange viene propagato al Dialog sottostante", async () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });
    // Il Dialog radice si apre perché payer non è null; chiudendolo
    // (Escape) il Dialog sottostante invoca onOpenChange(false).
    await userEvent.setup().keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
  });
});
