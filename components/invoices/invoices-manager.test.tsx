import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoicesManager } from "./invoices-manager";
import { EMPTY_INVOICE_FILTERS } from "./invoice-filters";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/invoices",
}));

// refreshInvoicePdfLayout/refreshInvoiceAnagrafica trascinano prisma se
// importate per intero: mockate come già fa login-form.test.tsx per `login`.
vi.mock("@/lib/actions/settings", () => ({
  refreshInvoicePdfLayout: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/lib/actions/invoices", () => ({
  refreshInvoiceAnagrafica: vi.fn(async () => ({ success: true })),
}));

// ExportInvoicesDialog accetta ancora `invoiceIds` (contratto `selection`
// introdotto qui ma implementato solo al Task 10): mockato per isolare questo
// test dalla dipendenza cross-task, che non riguarda la navigazione testata
// qui. Il mismatch di tipo resta e viene verificato separatamente con
// `npx tsc --noEmit`.
vi.mock("@/components/invoices/export-invoices-dialog", () => ({
  ExportInvoicesDialog: vi.fn(() => null),
}));

const baseProps = {
  invoices: [],
  totalCount: 0,
  page: 1,
  years: [2025, 2026],
  filters: EMPTY_INVOICE_FILTERS,
  payers: [],
  patients: [],
  nextInvoiceNumber: 1,
};

describe("InvoicesManager", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("nessuna fattura mai emessa (years vuoto): mostra il messaggio generico, non la filter bar", () => {
    render(<InvoicesManager {...baseProps} years={[]} />);
    expect(screen.getByText("Nessuna fattura emessa.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Anno")).not.toBeInTheDocument();
  });

  it("years non vuoto ma invoices vuoto: mostra la filter bar e il messaggio 'nessun risultato'", () => {
    render(<InvoicesManager {...baseProps} />);
    expect(screen.getByLabelText("Anno")).toBeInTheDocument();
    expect(
      screen.getByText("Nessuna fattura corrisponde ai filtri selezionati.")
    ).toBeInTheDocument();
  });

  it("cambiare l'anno naviga con f=1, il nuovo anno e resetta a page 1", async () => {
    const user = userEvent.setup();
    render(<InvoicesManager {...baseProps} years={[2025]} />);
    await user.click(screen.getByLabelText("Anno"));
    await user.click(screen.getByRole("option", { name: "2025" }));
    expect(replace).toHaveBeenCalledWith("/invoices?f=1&anno=2025", { scroll: false });
  });

  it("'Reset filtri' naviga all'URL nudo (senza f, per riapplicare il default)", async () => {
    const user = userEvent.setup();
    render(<InvoicesManager {...baseProps} filters={{ ...EMPTY_INVOICE_FILTERS, anno: "2025" }} />);
    await user.click(screen.getByRole("button", { name: "Reset filtri" }));
    expect(replace).toHaveBeenCalledWith("/invoices", { scroll: false });
  });
});
