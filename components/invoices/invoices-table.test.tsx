import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import type { Pagante, Paziente } from "@prisma/client";
import { InvoicesTable } from "./invoices-table";
import { makeInvoice } from "./test-fixtures";

// DeleteInvoiceButton (via InvoiceRowActions) importa deleteInvoice da
// lib/actions/invoices, che trascina prisma: mockato come già fa
// invoice-row-actions.test.tsx/invoices-manager.test.tsx per lo stesso
// modulo, altrimenti l'import fallisce in assenza di DATABASE_URL.
vi.mock("@/lib/actions/invoices", () => ({
  deleteInvoice: vi.fn(async () => ({ success: true })),
}));

// Wrapper: selectAllRef deve venire da un useRef reale (non un mock oggetto
// statico), esattamente come lo produce useInvoiceSelection in
// invoices-manager.tsx.
function TableWithRef(
  props: Omit<Parameters<typeof InvoicesTable>[0], "selectAllRef">
) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  return <InvoicesTable {...props} selectAllRef={selectAllRef} />;
}

function renderTable(
  overrides: Partial<Omit<Parameters<typeof InvoicesTable>[0], "selectAllRef">> = {}
) {
  const invoices = overrides.invoices ?? [makeInvoice()];
  return render(
    <TableWithRef
      invoices={invoices}
      selectedIds={new Set<number>()}
      toggleSelected={vi.fn()}
      toggleSelectAll={vi.fn()}
      onView={vi.fn()}
      onOpenRefreshPdf={vi.fn()}
      onOpenRefreshAnagrafica={vi.fn()}
      onEdit={vi.fn()}
      {...overrides}
    />
  );
}

describe("InvoicesTable", () => {
  it("renderizza le celle attese per ogni fattura", () => {
    const invoice = makeInvoice({
      n_fattura: 7,
      pagante: { cognome: "Rossi", nome: "Mario" } as Pagante,
      paziente: { cognome: "Verdi", nome: "Luca" } as Paziente,
      mod_pag: "CONTANTI",
    });
    renderTable({ invoices: [invoice] });

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Rossi Mario")).toBeInTheDocument();
    expect(screen.getByText("Verdi Luca")).toBeInTheDocument();
    expect(screen.getByText("CONTANTI")).toBeInTheDocument();
  });

  it("mostra '-' quando pagante/paziente sono null", () => {
    renderTable({ invoices: [makeInvoice({ pagante: null, paziente: null })] });
    expect(screen.getAllByText("-")).toHaveLength(2);
  });

  it("mostra il warning marca da bollo quando l'importo supera la soglia e bolloCodice è assente", () => {
    renderTable({
      invoices: [makeInvoice({ prezzo_totale: 1000, bolloCodice: null })],
    });
    expect(
      screen.getByLabelText("Marca da bollo dovuta: codice non ancora inserito")
    ).toBeInTheDocument();
  });

  it("non mostra il warning marca da bollo quando bolloCodice è già presente", () => {
    renderTable({
      invoices: [makeInvoice({ prezzo_totale: 1000, bolloCodice: "ABC123" })],
    });
    expect(
      screen.queryByLabelText("Marca da bollo dovuta: codice non ancora inserito")
    ).not.toBeInTheDocument();
  });

  it("il checkbox 'seleziona tutte' riflette selectedIds e chiama toggleSelectAll", async () => {
    const toggleSelectAll = vi.fn();
    const invoices = [makeInvoice({ id: 1 }), makeInvoice({ id: 2, n_fattura: 2 })];
    const user = userEvent.setup();
    renderTable({
      invoices,
      selectedIds: new Set([1, 2]),
      toggleSelectAll,
    });

    const selectAll = screen.getByRole("checkbox", {
      name: "Seleziona tutte le fatture visibili",
    });
    expect(selectAll).toBeChecked();

    await user.click(selectAll);
    expect(toggleSelectAll).toHaveBeenCalledWith(false);
  });

  it("il checkbox di riga chiama toggleSelected con id e checked", async () => {
    const toggleSelected = vi.fn();
    const user = userEvent.setup();
    renderTable({
      invoices: [makeInvoice({ id: 3, n_fattura: 3 })],
      selectedIds: new Set<number>(),
      toggleSelected,
    });

    const rowCheckbox = screen.getByRole("checkbox", {
      name: "Seleziona fattura 3",
    });
    expect(rowCheckbox).not.toBeChecked();

    await user.click(rowCheckbox);
    expect(toggleSelected).toHaveBeenCalledWith(3, true);
  });

  it("cliccare 'Visualizza dettagli fattura' chiama onView con la fattura", async () => {
    const onView = vi.fn();
    const invoice = makeInvoice({ id: 9 });
    const user = userEvent.setup();
    renderTable({ invoices: [invoice], onView });

    await user.click(screen.getByRole("button", { name: "Visualizza dettagli fattura" }));
    expect(onView).toHaveBeenCalledWith(invoice);
  });

  it("cliccare 'Aggiorna layout PDF' chiama onOpenRefreshPdf con la fattura", async () => {
    const onOpenRefreshPdf = vi.fn();
    const invoice = makeInvoice({ id: 9 });
    const user = userEvent.setup();
    renderTable({ invoices: [invoice], onOpenRefreshPdf });

    await user.click(screen.getByRole("button", { name: "Aggiorna layout PDF" }));
    expect(onOpenRefreshPdf).toHaveBeenCalledWith(invoice);
  });

  it("cliccare 'Aggiorna anagrafica' chiama onOpenRefreshAnagrafica con la fattura", async () => {
    const onOpenRefreshAnagrafica = vi.fn();
    const invoice = makeInvoice({ id: 9 });
    const user = userEvent.setup();
    renderTable({ invoices: [invoice], onOpenRefreshAnagrafica });

    await user.click(screen.getByRole("button", { name: "Aggiorna anagrafica" }));
    expect(onOpenRefreshAnagrafica).toHaveBeenCalledWith(invoice);
  });

  it("cliccare 'Modifica fattura' chiama onEdit con la fattura", async () => {
    const onEdit = vi.fn();
    const invoice = makeInvoice({ id: 9 });
    const user = userEvent.setup();
    renderTable({ invoices: [invoice], onEdit });

    await user.click(screen.getByRole("button", { name: "Modifica fattura" }));
    expect(onEdit).toHaveBeenCalledWith(invoice);
  });

  it("il link 'Scarica PDF' punta all'endpoint dell'API con l'id della fattura", () => {
    renderTable({ invoices: [makeInvoice({ id: 123 })] });
    const link = screen.getByRole("link", { name: "Scarica PDF" });
    expect(link).toHaveAttribute("href", "/api/invoices/123/pdf");
  });
});
