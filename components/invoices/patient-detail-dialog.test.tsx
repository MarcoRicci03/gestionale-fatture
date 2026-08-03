import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Pagante, Paziente } from "@prisma/client";
import { PatientDetailDialog } from "./patient-detail-dialog";

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

function makePaziente(
  overrides: Partial<Paziente & { pagante: Pagante | null }> = {}
): Paziente & { pagante: Pagante | null } {
  return {
    id: 10,
    id_Utente: 1,
    nome: "Anna",
    cognome: "Bianchi",
    id_Pagante: null,
    archiviato: false,
    pagante: null,
    ...overrides,
  } as Paziente & { pagante: Pagante | null };
}

function renderDialog(
  overrides: Partial<Parameters<typeof PatientDetailDialog>[0]> = {}
) {
  return render(
    <PatientDetailDialog
      patient={overrides.patient ?? makePaziente()}
      onOpenChange={vi.fn()}
      {...overrides}
    />
  );
}

describe("PatientDetailDialog", () => {
  it("patient null: il dialog resta chiuso, nessun campo renderizzato", () => {
    renderDialog({ patient: null });
    expect(screen.queryByText("Dettagli Paziente")).not.toBeInTheDocument();
  });

  it("renderizza i campi del paziente e del pagante associato quando presente", () => {
    const patient = makePaziente({
      nome: "Anna",
      cognome: "Bianchi",
      pagante: makePagante({
        nome: "Luca",
        cognome: "Verdi",
        via: "Via Milano 5",
        citta: "Milano",
        cap: "20100",
        cf: "VRDLCU80A01F205Z",
        piva: "12345678901",
      }),
    });
    renderDialog({ patient });

    expect(screen.getByText("Dettagli Paziente")).toBeInTheDocument();
    expect(screen.getByText("Bianchi")).toBeInTheDocument();
    expect(screen.getByText("Anna")).toBeInTheDocument();

    expect(screen.getByText("Pagante associato")).toBeInTheDocument();
    expect(screen.getByText("Verdi")).toBeInTheDocument();
    expect(screen.getByText("Luca")).toBeInTheDocument();
    expect(screen.getByText("Via Milano 5, Milano 20100")).toBeInTheDocument();
    expect(screen.getByText("VRDLCU80A01F205Z")).toBeInTheDocument();
    expect(screen.getByText("12345678901")).toBeInTheDocument();
    expect(
      screen.queryByText("Nessun pagante associato.")
    ).not.toBeInTheDocument();
  });

  it("pagante null: mostra 'Nessun pagante associato.' invece del blocco pagante", () => {
    renderDialog({ patient: makePaziente({ pagante: null }) });

    expect(
      screen.getByText("Nessun pagante associato.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Pagante associato")).not.toBeInTheDocument();
  });

  it("onOpenChange viene propagato al Dialog sottostante", async () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });
    // Il Dialog radice si apre perché patient non è null; chiudendolo
    // (Escape) il Dialog sottostante invoca onOpenChange(false).
    await userEvent.setup().keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
  });
});
