import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Pagante, Paziente } from "@prisma/client";
import { InvoicesCardList } from "./invoices-card-list";
import { makeInvoice } from "./test-fixtures";

// DeleteInvoiceButton (via InvoiceRowActions) importa deleteInvoice da
// lib/actions/invoices, che trascina prisma: mockato come già fa
// invoice-row-actions.test.tsx/invoices-table.test.tsx per lo stesso modulo,
// altrimenti l'import fallisce in assenza di DATABASE_URL.
vi.mock("@/lib/actions/invoices", () => ({
  deleteInvoice: vi.fn(async () => ({ success: true })),
}));

function renderCardList(
  overrides: Partial<Parameters<typeof InvoicesCardList>[0]> = {}
) {
  const invoices = overrides.invoices ?? [makeInvoice()];
  return render(
    <InvoicesCardList
      invoices={invoices}
      selectedIds={new Set<number>()}
      toggleSelected={vi.fn()}
      onView={vi.fn()}
      onOpenRefreshPdf={vi.fn()}
      onOpenRefreshAnagrafica={vi.fn()}
      onEdit={vi.fn()}
      {...overrides}
    />
  );
}

describe("InvoicesCardList", () => {
  it("renderizza i dati attesi per ogni fattura", () => {
    const invoice = makeInvoice({
      n_fattura: 7,
      pagante: { cognome: "Rossi", nome: "Mario" } as Pagante,
      paziente: { cognome: "Verdi", nome: "Luca" } as Paziente,
      mod_pag: "CONTANTI",
    });
    renderCardList({ invoices: [invoice] });

    expect(screen.getByText("N. 7")).toBeInTheDocument();
    expect(screen.getByText("Pagante: Rossi Mario")).toBeInTheDocument();
    expect(screen.getByText("Paziente: Verdi Luca")).toBeInTheDocument();
    expect(screen.getByText("Modalità: CONTANTI")).toBeInTheDocument();
  });

  it("mostra '-' quando pagante/paziente sono null", () => {
    renderCardList({ invoices: [makeInvoice({ pagante: null, paziente: null })] });
    expect(screen.getByText("Pagante: -")).toBeInTheDocument();
    expect(screen.getByText("Paziente: -")).toBeInTheDocument();
  });

  it("mostra il warning marca da bollo quando l'importo supera la soglia e bolloCodice è assente", () => {
    renderCardList({
      invoices: [makeInvoice({ prezzo_totale: 1000, bolloCodice: null })],
    });
    expect(
      screen.getByLabelText("Marca da bollo dovuta: codice non ancora inserito")
    ).toBeInTheDocument();
  });

  it("non mostra il warning marca da bollo quando bolloCodice è già presente", () => {
    renderCardList({
      invoices: [makeInvoice({ prezzo_totale: 1000, bolloCodice: "ABC123" })],
    });
    expect(
      screen.queryByLabelText("Marca da bollo dovuta: codice non ancora inserito")
    ).not.toBeInTheDocument();
  });

  it("il checkbox di riga riflette selectedIds e chiama toggleSelected con id e checked", async () => {
    const toggleSelected = vi.fn();
    const user = userEvent.setup();
    renderCardList({
      invoices: [makeInvoice({ id: 3, n_fattura: 3 })],
      selectedIds: new Set<number>(),
      toggleSelected,
    });

    const checkbox = screen.getByRole("checkbox", {
      name: "Seleziona fattura 3",
    });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(toggleSelected).toHaveBeenCalledWith(3, true);
  });

  it("cliccare 'Visualizza dettagli fattura' chiama onView con la fattura", async () => {
    const onView = vi.fn();
    const invoice = makeInvoice({ id: 9 });
    const user = userEvent.setup();
    renderCardList({ invoices: [invoice], onView });

    await user.click(screen.getByRole("button", { name: "Visualizza dettagli fattura" }));
    expect(onView).toHaveBeenCalledWith(invoice);
  });

  it("cliccare 'Aggiorna layout PDF' chiama onOpenRefreshPdf con la fattura", async () => {
    const onOpenRefreshPdf = vi.fn();
    const invoice = makeInvoice({ id: 9 });
    const user = userEvent.setup();
    renderCardList({ invoices: [invoice], onOpenRefreshPdf });

    await user.click(screen.getByRole("button", { name: "Aggiorna layout PDF" }));
    expect(onOpenRefreshPdf).toHaveBeenCalledWith(invoice);
  });

  it("cliccare 'Aggiorna anagrafica' chiama onOpenRefreshAnagrafica con la fattura", async () => {
    const onOpenRefreshAnagrafica = vi.fn();
    const invoice = makeInvoice({ id: 9 });
    const user = userEvent.setup();
    renderCardList({ invoices: [invoice], onOpenRefreshAnagrafica });

    await user.click(screen.getByRole("button", { name: "Aggiorna anagrafica" }));
    expect(onOpenRefreshAnagrafica).toHaveBeenCalledWith(invoice);
  });

  it("cliccare 'Modifica fattura' chiama onEdit con la fattura", async () => {
    const onEdit = vi.fn();
    const invoice = makeInvoice({ id: 9 });
    const user = userEvent.setup();
    renderCardList({ invoices: [invoice], onEdit });

    await user.click(screen.getByRole("button", { name: "Modifica fattura" }));
    expect(onEdit).toHaveBeenCalledWith(invoice);
  });

  it("il link 'Scarica PDF' punta all'endpoint dell'API con l'id della fattura", () => {
    renderCardList({ invoices: [makeInvoice({ id: 123 })] });
    const link = screen.getByRole("link", { name: "Scarica PDF" });
    expect(link).toHaveAttribute("href", "/api/invoices/123/pdf");
  });
});
