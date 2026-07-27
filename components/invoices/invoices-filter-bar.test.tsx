// components/invoices/invoices-filter-bar.test.tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoicesFilterBar } from "./invoices-filter-bar";
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
});
