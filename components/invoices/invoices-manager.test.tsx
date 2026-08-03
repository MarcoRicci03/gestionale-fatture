import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoicesManager } from "./invoices-manager";
import { EMPTY_INVOICE_FILTERS } from "./invoice-filters";
import { makeInvoice as makeInvoiceBase } from "./test-fixtures";

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

// ExportInvoicesDialog NON è mockato: è un client component "puro" (fetch +
// stato locale, niente prisma/server-only), esattamente come gli altri
// componenti già testati senza mock in questo file. Mockarlo nasconderebbe
// proprio il punto più critico di questo refactor: che "esporta senza righe
// selezionate" significhi "tutte le fatture del filtro corrente"
// (`selection: { kind: "filters", filters, count: totalCount }`), non solo
// quelle della pagina visibile — vedi i test "export selection" più sotto.

// Wrapper posizionale (id) sulla fixture condivisa, invariato per non
// toccare le chiamate makeInvoice(1)/makeInvoice(2) più sotto in questo file.
function makeInvoice(id: number) {
  return makeInvoiceBase({ id, n_fattura: id });
}

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

const originalFetch = global.fetch;

describe("InvoicesManager", () => {
  beforeEach(() => {
    replace.mockClear();
    // ExportInvoicesDialog (ora non mockato) chiama fetch() solo al click su
    // "Esporta": nessuno dei test qui sotto lo aziona, ma si mocka comunque
    // per non lasciare una vera network call raggiungibile per errore, come
    // già fa export-invoices-dialog.test.tsx.
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(),
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
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

  it("due cambi filtro ravvicinati senza re-render nel mezzo (RSC round-trip non ancora arrivato): il secondo replace() include ENTRAMBI i patch, non solo l'ultimo", async () => {
    const user = userEvent.setup();
    // `filters` resta la prop iniziale per tutto il test (nessun rerender):
    // simula esattamente lo scenario del bug, in cui il secondo cambio
    // filtro arriva prima che il round-trip RSC del primo abbia aggiornato
    // la prop `filters` del Server Component.
    render(<InvoicesManager {...baseProps} years={[2025]} />);

    await user.click(screen.getByLabelText("Anno"));
    await user.click(screen.getByRole("option", { name: "2025" }));

    fireEvent.change(screen.getByLabelText("Data da"), {
      target: { value: "2026-01-01" },
    });

    expect(replace).toHaveBeenCalledTimes(2);
    const secondUrl = (replace.mock.calls[1] as [string, unknown])[0];
    expect(secondUrl).toContain("anno=2025");
    expect(secondUrl).toContain("dataDa=2026-01-01");
  });

  it("nessuna riga selezionata: il dialog di export mostra il totale filtrato (totalCount), non la lunghezza della pagina corrente", async () => {
    const user = userEvent.setup();
    render(
      <InvoicesManager
        {...baseProps}
        invoices={[makeInvoice(1), makeInvoice(2)]}
        totalCount={50}
        years={[2026]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Esporta Excel" }));

    // Query scoperta al dialog di export: "50"/"1" compaiono altrove nella
    // pagina (id fattura, celle tabella) e getByText su tutto il documento
    // sarebbe ambiguo.
    const dialog = screen.getByRole("dialog", { name: "Esporta fatture in Excel" });
    // 50 (totalCount, il filtro intero), non 2 (le sole righe nella pagina
    // corrente): questo è esattamente il comportamento che il refactor
    // LOG-05 doveva introdurre e che non deve regredire silenziosamente.
    expect(within(dialog).getByText("50")).toBeInTheDocument();
  });

  it("con righe selezionate: il dialog di export mostra il conteggio degli id selezionati, non totalCount", async () => {
    const user = userEvent.setup();
    render(
      <InvoicesManager
        {...baseProps}
        invoices={[makeInvoice(1), makeInvoice(2)]}
        totalCount={50}
        years={[2026]}
      />
    );

    const [checkbox] = screen.getAllByRole("checkbox", {
      name: "Seleziona fattura 1",
    });
    await user.click(checkbox);

    await user.click(screen.getByRole("button", { name: "Esporta Excel" }));

    const dialog = screen.getByRole("dialog", { name: "Esporta fatture in Excel" });
    expect(within(dialog).getByText("1")).toBeInTheDocument();
    expect(within(dialog).queryByText("50")).not.toBeInTheDocument();
  });
});
