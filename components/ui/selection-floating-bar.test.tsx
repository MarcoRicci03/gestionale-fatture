import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectionFloatingBar } from "./selection-floating-bar";

describe("SelectionFloatingBar", () => {
  it("non renderizza nulla se count <= 0", () => {
    const { container } = render(
      <SelectionFloatingBar count={0} onClear={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderizza il conteggio singolare e plurale correttamente", () => {
    const { rerender } = render(
      <SelectionFloatingBar count={1} />
    );
    expect(screen.getByText("1 selezionato")).toBeInTheDocument();

    rerender(<SelectionFloatingBar count={3} />);
    expect(screen.getByText("3 selezionati")).toBeInTheDocument();
  });

  it("renderizza countLabel e totalLabel personalizzati", () => {
    render(
      <SelectionFloatingBar
        count={5}
        countLabel="elementi scelti"
        totalLabel="5 elementi selezionati in totale"
      />
    );
    expect(screen.getByText("5 elementi scelti")).toBeInTheDocument();
    expect(screen.getByText("5 elementi selezionati in totale")).toBeInTheDocument();
  });

  it("chiama onClear al clic sul pulsante di deselezione", async () => {
    const user = userEvent.setup();
    const handleClear = vi.fn();

    render(
      <SelectionFloatingBar
        count={2}
        onClear={handleClear}
        clearLabel="Annulla selezione"
      />
    );

    const btn = screen.getByRole("button", { name: "Annulla selezione" });
    await user.click(btn);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it("renderizza i children (azioni extra)", () => {
    render(
      <SelectionFloatingBar count={2}>
        <button type="button">Azione Extra</button>
      </SelectionFloatingBar>
    );
    expect(screen.getByRole("button", { name: "Azione Extra" })).toBeInTheDocument();
  });
});
