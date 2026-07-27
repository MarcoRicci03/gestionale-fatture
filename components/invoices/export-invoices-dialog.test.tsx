import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportInvoicesDialog } from "./export-invoices-dialog";
import { EMPTY_INVOICE_FILTERS } from "./invoice-filters";

const originalFetch = global.fetch;

describe("ExportInvoicesDialog", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(),
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("selection 'ids': mostra il conteggio degli id selezionati", () => {
    render(
      <ExportInvoicesDialog
        open
        onOpenChange={vi.fn()}
        selection={{ kind: "ids", ids: [1, 2, 3] }}
      />
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("selection 'filters': mostra il count passato, non la lunghezza di un array", () => {
    render(
      <ExportInvoicesDialog
        open
        onOpenChange={vi.fn()}
        selection={{ kind: "filters", filters: EMPTY_INVOICE_FILTERS, count: 130 }}
      />
    );
    expect(screen.getByText("130")).toBeInTheDocument();
  });

  it("selection 'ids': invia { ids, columns } al POST", async () => {
    const user = userEvent.setup();
    render(
      <ExportInvoicesDialog
        open
        onOpenChange={vi.fn()}
        selection={{ kind: "ids", ids: [1, 2] }}
      />
    );
    await user.click(screen.getByRole("button", { name: "Esporta" }));
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.ids).toEqual([1, 2]);
    expect(body.filters).toBeUndefined();
  });

  it("selection 'filters': invia { filters, columns } al POST", async () => {
    const user = userEvent.setup();
    render(
      <ExportInvoicesDialog
        open
        onOpenChange={vi.fn()}
        selection={{ kind: "filters", filters: { ...EMPTY_INVOICE_FILTERS, anno: "2025" }, count: 5 }}
      />
    );
    await user.click(screen.getByRole("button", { name: "Esporta" }));
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.filters).toEqual({ ...EMPTY_INVOICE_FILTERS, anno: "2025" });
    expect(body.ids).toBeUndefined();
  });
});
