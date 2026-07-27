// components/invoices/invoices-filter-bar.test.tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoicesFilterBar } from "./invoices-filter-bar";
import type { InvoiceFilters } from "./invoice-filters";
import { EMPTY_INVOICE_FILTERS } from "./invoice-filters";

function setup(onChange = vi.fn()) {
  render(
    <InvoicesFilterBar
      filters={EMPTY_INVOICE_FILTERS}
      onChange={onChange}
      onReset={vi.fn()}
      payers={[]}
      patients={[]}
      years={[2025, 2026]}
    />
  );
  return onChange;
}

function renderFilterBar(filters: InvoiceFilters, onChange = vi.fn()) {
  const utils = render(
    <InvoicesFilterBar
      filters={filters}
      onChange={onChange}
      onReset={vi.fn()}
      payers={[]}
      patients={[]}
      years={[2025, 2026]}
    />
  );
  const rerenderWithFilters = (nextFilters: InvoiceFilters) =>
    utils.rerender(
      <InvoicesFilterBar
        filters={nextFilters}
        onChange={onChange}
        onReset={vi.fn()}
        payers={[]}
        patients={[]}
        years={[2025, 2026]}
      />
    );
  return { onChange, rerenderWithFilters };
}

describe("InvoicesFilterBar - campo persona", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("non chiama onChange finché l'utente digita entro 300ms", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = setup();
    await user.type(screen.getByLabelText("Pagante o paziente"), "Rossi");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("chiama onChange con l'ultimo valore dopo 300ms di inattività", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = setup();
    await user.type(screen.getByLabelText("Pagante o paziente"), "Rossi");
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ persona: "Rossi" });
  });

  it("flush immediato al blur, anche prima dei 300ms", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = setup();
    const input = screen.getByLabelText("Pagante o paziente");
    await user.type(input, "Rossi");
    await user.tab();
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ persona: "Rossi" });
  });

  it("gli altri campi (es. anno) chiamano onChange immediatamente, senza debounce", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = setup();
    await user.click(screen.getByLabelText("Anno"));
    await user.click(screen.getByRole("option", { name: "2025" }));
    expect(onChange).toHaveBeenCalledWith({ anno: "2025" });
  });

  it("un cambio esterno del valore (es. dopo 'Reset filtri') durante il debounce vince: non richiama onChange con il valore digitato stale", async () => {
    const user = userEvent.setup({ delay: null });
    const initialFilters: InvoiceFilters = { ...EMPTY_INVOICE_FILTERS, persona: "Mario" };
    const { onChange, rerenderWithFilters } = renderFilterBar(initialFilters);

    const input = screen.getByLabelText("Pagante o paziente");
    await user.type(input, "X");
    // Prima che il debounce (300ms) scada, il genitore riporta filters.persona
    // a "" (es. l'utente ha cliccato "Reset filtri" a t+100ms).
    vi.advanceTimersByTime(100);
    rerenderWithFilters({ ...EMPTY_INVOICE_FILTERS, persona: "" });

    vi.advanceTimersByTime(300);

    expect(onChange).not.toHaveBeenCalledWith({ persona: "MarioX" });
  });
});
