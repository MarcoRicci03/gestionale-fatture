import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Pagamento, Pagante, Paziente, FatturaMese } from "@prisma/client";
import { InvoiceDetailDialog } from "./invoice-detail-dialog";

// Stessa forma di InvoiceWithRelations in invoices-manager.tsx, duplicata
// come fixture (stesso pattern di invoices-card-list.test.tsx) per non dover
// importare da invoices-manager.tsx nel test.
type InvoiceFixture = Omit<Pagamento, "prezzo_totale"> & {
  prezzo_totale: number;
  mesi: (Omit<FatturaMese, "prezzo"> & { prezzo: number })[];
  pagante: Pagante | null;
  paziente: Paziente | null;
};

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

function makePaziente(overrides: Partial<Paziente> = {}): Paziente {
  return {
    id: 1,
    id_Utente: 1,
    id_Pagante: 1,
    nome: "Luca",
    cognome: "Verdi",
    archiviato: false,
    archiviatoInCascata: false,
    ...overrides,
  } as Paziente;
}

function makeInvoice(overrides: Partial<InvoiceFixture> = {}): InvoiceFixture {
  return {
    id: 1,
    id_Utente: 1,
    id_Pagante: 1,
    id_Paziente: 1,
    prezzo_totale: 100,
    mod_pag: "BONIFICO",
    sedute: null,
    commento: null,
    n_fattura: 1,
    anno: 2026,
    data: new Date("2026-01-15"),
    citta: "Roma",
    cap: "00100",
    pdfLayoutSnapshot: null,
    bolloCodice: null,
    snapshotAnagrafica: null,
    pagante: null,
    paziente: null,
    mesi: [],
    ...overrides,
  };
}

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
      ] as InvoiceFixture["mesi"],
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
