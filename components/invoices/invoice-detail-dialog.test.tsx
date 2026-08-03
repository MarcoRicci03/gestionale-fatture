import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceDetailDialog } from "./invoice-detail-dialog";
import { makeInvoice, makePagante, makePaziente } from "./test-fixtures";
import type { InvoiceListItem } from "./types";

function renderDialog(
  overrides: Partial<Parameters<typeof InvoiceDetailDialog>[0]> = {}
) {
  return render(
    <InvoiceDetailDialog
      invoice={overrides.invoice ?? makeInvoice()}
      onOpenChange={vi.fn()}
      onViewPayer={vi.fn()}
      onViewPatient={vi.fn()}
      {...overrides}
    />
  );
}

describe("InvoiceDetailDialog", () => {
  it("invoice null: il dialog resta chiuso, nessun campo renderizzato", () => {
    renderDialog({ invoice: null });
    expect(screen.queryByText("Dettagli Fattura")).not.toBeInTheDocument();
  });

  it("renderizza i campi principali della fattura", () => {
    const invoice = makeInvoice({
      n_fattura: 7,
      mod_pag: "CONTANTI",
      sedute: 3,
      commento: "Nota di prova",
      mesi: [
        { id: 1, id_Pagamento: 1, mese: "GENNAIO", prezzo: 60 },
        { id: 2, id_Pagamento: 1, mese: "FEBBRAIO", prezzo: 40 },
      ] as InvoiceListItem["mesi"],
      prezzo_totale: 100,
    });
    renderDialog({ invoice });

    expect(screen.getByText("Dettagli Fattura")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("GENNAIO, FEBBRAIO")).toBeInTheDocument();
    expect(screen.getByText("CONTANTI")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Nota di prova")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Scarica PDF" });
    expect(link).toHaveAttribute("href", "/api/invoices/1/pdf");
  });

  it("marca da bollo: mostra il warning quando l'importo supera la soglia e bolloCodice è assente", () => {
    renderDialog({
      invoice: makeInvoice({ prezzo_totale: 1000, bolloCodice: null }),
    });
    expect(
      screen.getByText("Dovuta, codice non ancora inserito")
    ).toBeInTheDocument();
  });

  it("marca da bollo: mostra il codice quando bolloCodice è presente", () => {
    renderDialog({
      invoice: makeInvoice({ prezzo_totale: 1000, bolloCodice: "ABC123" }),
    });
    expect(screen.getByText("ABC123")).toBeInTheDocument();
  });

  it("marca da bollo: mostra 'Non dovuta' sotto soglia e senza codice", () => {
    renderDialog({
      invoice: makeInvoice({ prezzo_totale: 1, bolloCodice: null }),
    });
    expect(screen.getByText("Non dovuta")).toBeInTheDocument();
  });

  it("blocco pagante/paziente NON viene mostrato quando pagante o paziente sono null (resolvedAnagrafica null)", () => {
    renderDialog({
      invoice: makeInvoice({ pagante: null, paziente: makePaziente() }),
    });
    expect(screen.queryByText("Pagante")).not.toBeInTheDocument();
    expect(screen.queryByText("Paziente")).not.toBeInTheDocument();
  });

  it("blocco pagante/paziente viene mostrato quando entrambi sono presenti", () => {
    renderDialog({
      invoice: makeInvoice({
        pagante: makePagante(),
        paziente: makePaziente(),
      }),
    });
    expect(screen.getByText("Pagante")).toBeInTheDocument();
    expect(screen.getByText("Rossi Mario")).toBeInTheDocument();
    expect(screen.getByText("Paziente")).toBeInTheDocument();
    expect(screen.getByText("Verdi Luca")).toBeInTheDocument();
  });

  it("click 'Vedi dettagli pagante' chiama onViewPayer con invoice.pagante", async () => {
    const onViewPayer = vi.fn();
    const pagante = makePagante();
    const user = userEvent.setup();
    renderDialog({
      invoice: makeInvoice({ pagante, paziente: makePaziente() }),
      onViewPayer,
    });

    await user.click(
      screen.getByRole("button", { name: "Vedi dettagli pagante" })
    );
    expect(onViewPayer).toHaveBeenCalledWith(pagante);
  });

  it("click 'Vedi dettagli paziente' chiama onViewPatient con { ...paziente, pagante }", async () => {
    const onViewPatient = vi.fn();
    const pagante = makePagante();
    const paziente = makePaziente();
    const user = userEvent.setup();
    renderDialog({
      invoice: makeInvoice({ pagante, paziente }),
      onViewPatient,
    });

    await user.click(
      screen.getByRole("button", { name: "Vedi dettagli paziente" })
    );
    expect(onViewPatient).toHaveBeenCalledWith({ ...paziente, pagante });
  });

  it("paziente archiviato (assente da un ipotetico elenco 'attivi'): onViewPatient viene comunque chiamato usando SOLO invoice.paziente, senza alcuna prop 'patients'", async () => {
    // Il paziente qui simula un archiviato: `archiviato: true` e un id che
    // deliberatamente non comparirebbe in nessun elenco filtrato sugli
    // attivi passato dal chiamante. Il componente non riceve MAI una prop
    // `patients`/elenco pazienti: strutturalmente non può guardare altrove
    // che in `invoice.paziente`, quindi questo comportamento non può
    // regredire per costruzione.
    const onViewPatient = vi.fn();
    const pagante = makePagante();
    const paziente = makePaziente({
      id: 999,
      archiviato: true,
      nome: "Archiviato",
      cognome: "Paziente",
    });
    const user = userEvent.setup();
    renderDialog({
      invoice: makeInvoice({ pagante, paziente }),
      onViewPatient,
    });

    await user.click(
      screen.getByRole("button", { name: "Vedi dettagli paziente" })
    );
    expect(onViewPatient).toHaveBeenCalledWith({ ...paziente, pagante });
  });

  it("onOpenChange viene propagato al Dialog sottostante", async () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });
    // Il Dialog radice si apre perché invoice non è null; chiudendolo
    // (Escape) il Dialog sottostante invoca onOpenChange(false).
    await userEvent.setup().keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
  });
});
