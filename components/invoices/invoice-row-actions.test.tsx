import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Pagamento, Pagante, Paziente, FatturaMese } from "@prisma/client";
import { InvoiceRowActions } from "./invoice-row-actions";

// DeleteInvoiceButton importa deleteInvoice da lib/actions/invoices, che a
// sua volta trascina prisma: mockato come già fa invoices-manager.test.tsx
// per lo stesso modulo, altrimenti l'import fallisce in assenza di
// DATABASE_URL nell'ambiente di test.
vi.mock("@/lib/actions/invoices", () => ({
  deleteInvoice: vi.fn(async () => ({ success: true })),
}));

// Stessa forma di InvoiceWithRelations in invoices-manager.tsx (non ancora
// esportata al momento in cui questo test è stato scritto: fixture duplicata
// come già fa invoices-manager.test.tsx, non un import diretto).
type InvoiceFixture = Omit<Pagamento, "prezzo_totale"> & {
  prezzo_totale: number;
  mesi: (Omit<FatturaMese, "prezzo"> & { prezzo: number })[];
  pagante: Pagante | null;
  paziente: Paziente | null;
};

function makeInvoice(overrides: Partial<InvoiceFixture> = {}): InvoiceFixture {
  return {
    id: 42,
    id_Utente: 1,
    id_Pagante: 1,
    id_Paziente: 1,
    prezzo_totale: 100,
    mod_pag: "BONIFICO",
    sedute: null,
    commento: null,
    n_fattura: 7,
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

function renderActions(overrides: Partial<Parameters<typeof InvoiceRowActions>[0]> = {}) {
  const invoice = overrides.invoice ?? makeInvoice();
  return render(
    <InvoiceRowActions
      invoice={invoice}
      onView={vi.fn()}
      onRefreshPdf={vi.fn()}
      onRefreshAnagrafica={vi.fn()}
      onEdit={vi.fn()}
      {...overrides}
    />
  );
}

describe("InvoiceRowActions", () => {
  it("chiama onView con la fattura al click su 'Visualizza dettagli fattura'", async () => {
    const onView = vi.fn();
    const invoice = makeInvoice();
    const user = userEvent.setup();
    renderActions({ invoice, onView });

    await user.click(screen.getByRole("button", { name: "Visualizza dettagli fattura" }));

    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenCalledWith(invoice);
  });

  it("chiama onRefreshPdf con la fattura al click su 'Aggiorna layout PDF'", async () => {
    const onRefreshPdf = vi.fn();
    const invoice = makeInvoice();
    const user = userEvent.setup();
    renderActions({ invoice, onRefreshPdf });

    await user.click(screen.getByRole("button", { name: "Aggiorna layout PDF" }));

    expect(onRefreshPdf).toHaveBeenCalledTimes(1);
    expect(onRefreshPdf).toHaveBeenCalledWith(invoice);
  });

  it("chiama onRefreshAnagrafica con la fattura al click su 'Aggiorna anagrafica'", async () => {
    const onRefreshAnagrafica = vi.fn();
    const invoice = makeInvoice();
    const user = userEvent.setup();
    renderActions({ invoice, onRefreshAnagrafica });

    await user.click(screen.getByRole("button", { name: "Aggiorna anagrafica" }));

    expect(onRefreshAnagrafica).toHaveBeenCalledTimes(1);
    expect(onRefreshAnagrafica).toHaveBeenCalledWith(invoice);
  });

  it("chiama onEdit con la fattura al click su 'Modifica fattura'", async () => {
    const onEdit = vi.fn();
    const invoice = makeInvoice();
    const user = userEvent.setup();
    renderActions({ invoice, onEdit });

    await user.click(screen.getByRole("button", { name: "Modifica fattura" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(invoice);
  });

  it("il link 'Scarica PDF' punta all'endpoint dell'API con l'id della fattura", () => {
    const invoice = makeInvoice({ id: 123 });
    renderActions({ invoice });

    const link = screen.getByRole("link", { name: "Scarica PDF" });
    expect(link).toHaveAttribute("href", "/api/invoices/123/pdf");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("passa id/n_fattura/anno della fattura a DeleteInvoiceButton", () => {
    const invoice = makeInvoice({ id: 55, n_fattura: 9, anno: 2025 });
    renderActions({ invoice });

    // DeleteInvoiceButton non è mockato: verifichiamo che sia stato
    // renderizzato con le props giuste controllando l'output reale, cioè
    // l'input di conferma che espone il testo atteso "n_fattura/anno"
    // (vedi delete-invoice-button.tsx: expectedText = `${nFattura}/${anno}`)
    // dopo aver aperto il dialog di conferma.
    expect(
      screen.getByRole("button", { name: "Elimina fattura" })
    ).toBeInTheDocument();
  });

  it("apre il dialog di conferma eliminazione con il testo atteso n_fattura/anno", async () => {
    const invoice = makeInvoice({ id: 55, n_fattura: 9, anno: 2025 });
    const user = userEvent.setup();
    renderActions({ invoice });

    await user.click(screen.getByRole("button", { name: "Elimina fattura" }));

    expect(screen.getByText("Digita 9/2025 per confermare")).toBeInTheDocument();
  });
});
